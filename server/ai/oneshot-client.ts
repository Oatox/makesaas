import { setTimeout as sleep } from "node:timers/promises";
import { logger } from "../lib/logger";

// Docs: https://oneshotapi.com/docs (jobs: /docs/guides/jobs, errors: /docs/guides/errors)
const BASE_URL = "https://api.oneshotapi.com";
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_JOB_TIMEOUT_MS = 120_000;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type JsonGenerationRequest = {
  model: string;
  messages: ChatMessage[];
  /** JSON Schema subset enforced by OneShotAPI before the job succeeds. */
  responseSchema: object;
};

export type JsonGenerationResult = { jobId: string; json: unknown };

export type ChatStreamRequest = { model: string; messages: ChatMessage[]; signal?: AbortSignal };

const CHAT_STREAM_TIMEOUT_MS = 120_000;

type ApiErrorBody = { code?: string; message?: string; retryable?: boolean; requestId?: string };

type Job = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  // The guide documents `textResponse`, the API reference example shows `text`: accept both.
  result?: { textResponse?: string; text?: string } | null;
  error?: ApiErrorBody | null;
};

export class OneShotError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: { retryable?: boolean; requestId?: string; jobId?: string } = {},
  ) {
    super(message);
    this.name = "OneShotError";
  }
}

/** Minimal OneShotAPI client for asynchronous Gemini text jobs with JSON output. */
export class OneShotClient {
  constructor(
    private readonly apiKey: string,
    private readonly options: { pollIntervalMs?: number; jobTimeoutMs?: number } = {},
  ) {}

  async generateJson({ model, messages, responseSchema }: JsonGenerationRequest): Promise<JsonGenerationResult> {
    const accepted = await this.request<{ id: string }>(`/v1/models/${encodeURIComponent(model)}/jobs`, {
      method: "POST",
      body: JSON.stringify({ messages, options: { responseFormat: "json_schema", responseSchema } }),
    });

    const job = await this.waitForJob(accepted.id);
    const text = job.result?.textResponse ?? job.result?.text;

    if (typeof text !== "string") {
      throw new OneShotError("empty_result", "OneShotAPI job completed without a text response", { jobId: job.id });
    }

    try {
      return { jobId: job.id, json: JSON.parse(text) };
    } catch {
      throw new OneShotError("invalid_json", "OneShotAPI returned a non-JSON response", { jobId: job.id });
    }
  }

  /**
   * Synchronous chat (`/v1/chat/completions`, stream=true): yields text deltas as they arrive.
   * Errors after the stream started come as SSE `error` objects and are thrown as OneShotError.
   */
  async *streamChat({ model, messages, signal }: ChatStreamRequest): AsyncGenerator<string> {
    let response: Response;
    try {
      response = await fetch(new URL("/v1/chat/completions", BASE_URL), {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
        signal: AbortSignal.any([AbortSignal.timeout(CHAT_STREAM_TIMEOUT_MS), ...(signal ? [signal] : [])]),
      });
    } catch {
      throw new OneShotError("network_error", "OneShotAPI is unreachable", { retryable: true });
    }

    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => null);
      const error: ApiErrorBody = payload?.error ?? {};
      logger.warn({ status: response.status, code: error.code, requestId: error.requestId }, "OneShotAPI chat request failed");
      throw new OneShotError(error.code ?? `http_${response.status}`, error.message ?? `OneShotAPI answered ${response.status}`, {
        retryable: error.retryable,
        requestId: error.requestId,
      });
    }

    const jobId = response.headers.get("x-job-id") ?? undefined;
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        if (data === "[DONE]") return;

        let payload: { choices?: Array<{ delta?: { content?: string } }>; error?: ApiErrorBody };
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }
        if (payload.error) {
          throw new OneShotError(payload.error.code ?? "stream_error", payload.error.message ?? "OneShotAPI chat failed", {
            retryable: payload.error.retryable,
            requestId: payload.error.requestId,
            jobId,
          });
        }
        const delta = payload.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }

    // The stream must end with [DONE]; anything else is a truncated answer.
    throw new OneShotError("stream_interrupted", "OneShotAPI chat stream ended early", { jobId });
  }

  private async waitForJob(jobId: string): Promise<Job> {
    const deadline = Date.now() + (this.options.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS);
    const interval = this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    while (Date.now() < deadline) {
      await sleep(interval);
      const job = await this.request<Job>(`/v1/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });

      if (job.status === "completed") return job;
      if (job.status === "failed") {
        throw new OneShotError(job.error?.code ?? "job_failed", job.error?.message ?? "OneShotAPI job failed", {
          retryable: job.error?.retryable,
          requestId: job.error?.requestId,
          jobId,
        });
      }
    }

    // The job keeps running on OneShotAPI's side; never recreate it blindly (it is billed).
    throw new OneShotError("job_timeout", "OneShotAPI job did not finish in time", { jobId });
  }

  private async request<T>(path: string, init: { method: "GET" | "POST"; body?: string }): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, BASE_URL), {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new OneShotError("network_error", "OneShotAPI is unreachable", { retryable: true });
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error: ApiErrorBody = payload?.error ?? {};
      logger.warn({ path, status: response.status, code: error.code, requestId: error.requestId }, "OneShotAPI request failed");
      throw new OneShotError(error.code ?? `http_${response.status}`, error.message ?? `OneShotAPI answered ${response.status}`, {
        retryable: error.retryable,
        requestId: error.requestId,
      });
    }

    return payload as T;
  }
}
