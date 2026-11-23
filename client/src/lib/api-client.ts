import { supabase } from "@/lib/supabase";
import { AUTH_CONFIG } from "@/config/auth";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Machine-readable reason sent by some routes (e.g. QUOTA_EXHAUSTED, SUBSCRIPTION_REQUIRED). */
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number>;
  /** Sent as JSON; a Blob (e.g. an image File) is sent as is, with its own type. */
  body?: unknown;
  signal?: AbortSignal;
};

function encodeBody(body: unknown): { body?: BodyInit; contentType?: string } {
  if (body === undefined) return {};
  if (body instanceof Blob) return { body, contentType: body.type || "application/octet-stream" };
  return { body: JSON.stringify(body), contentType: "application/json" };
}

const SESSION_EXPIRED = "Session expirée. Veuillez vous reconnecter.";

/** Current Supabase access token, for calls that cannot go through apiRequest (e.g. streamed responses). */
export async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new ApiError(401, SESSION_EXPIRED);
  return session.access_token;
}

/** The successful response of an API call; signs out on 401 and throws ApiError on any other error. */
async function apiFetch(path: string, { method = "GET", query, body, signal }: ApiRequestOptions): Promise<Response> {
  const accessToken = await getAccessToken();
  const url = query ? `${path}?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}` : path;
  const encoded = encodeBody(body);

  const response = await fetch(url, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(encoded.contentType ? { "Content-Type": encoded.contentType } : {}),
    },
    body: encoded.body,
  });

  if (response.status === 401) {
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace(AUTH_CONFIG.LOGIN_PATH);
    throw new ApiError(401, SESSION_EXPIRED);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = typeof payload?.message === "string" ? payload.message : "Une erreur est survenue, réessayez.";
    throw new ApiError(response.status, message, typeof payload?.code === "string" ? payload.code : undefined);
  }

  return response;
}

/**
 * Calls the Express API with the current Supabase access token.
 * Throws ApiError with the server's (French) message so the UI can show it as is.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/**
 * Same as apiRequest for a route answering a stream of JSON lines (NDJSON): yields each object as
 * it arrives. Errors before the stream starts are thrown as ApiError.
 */
export async function* apiStream<T>(path: string, options: ApiRequestOptions = {}): AsyncGenerator<T> {
  const response = await apiFetch(path, options);
  if (!response.body) throw new ApiError(response.status, "Réponse vide du serveur, réessayez.");

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) yield JSON.parse(line) as T;
    }
    if (buffer.trim()) yield JSON.parse(buffer) as T;
  } finally {
    // Stops the download if the caller stopped reading early (no-op once the stream ended).
    void reader.cancel().catch(() => undefined);
  }
}
