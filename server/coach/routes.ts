import type { Express, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_PIPELINE_SLUGS, type AiPipelineUpdate, type CoachTemplateVariable } from "@shared/ai-pipeline";
import {
  COACH_CONVERSATION_COLUMNS,
  COACH_HISTORY_MESSAGES,
  COACH_MESSAGE_COLUMNS,
  coachApi,
  coachSendBodySchema,
  conversationTitleFrom,
  type CoachConversation,
  type CoachMessage,
  type CoachStreamEvent,
} from "@shared/coach";
import { OneShotClient, OneShotError, type ChatMessage } from "../ai/oneshot-client";
import { AiPipelineNotFoundError, AiPipelineRepository, renderTemplate } from "../ai/pipelines";
import { getUserId, requireSubscriber } from "../lib/auth";
import { asyncRoute, HttpError, parseInput } from "../lib/http";
import { buildCoachContext } from "./context";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { HOUR_MS } from "../lib/time";

// Every answer costs OneShotAPI credits: a member can send this many messages per hour. Kept in
// memory, like the conversations being answered: enough for a single server instance.
const MAX_MESSAGES_PER_HOUR = 60;
const recentMessages = new Map<string, number[]>();

function takeMessageSlot(userId: string): boolean {
  const since = Date.now() - HOUR_MS;
  const sent = (recentMessages.get(userId) ?? []).filter((time) => time > since);
  if (sent.length >= MAX_MESSAGES_PER_HOUR) return false;
  sent.push(Date.now());
  recentMessages.set(userId, sent);
  return true;
}

/** Conversations Gus is answering right now: one answer at a time in each. */
const answering = new Set<string>();

type Turn = Pick<CoachMessage, "role" | "content">;
type SystemVariables = Record<Exclude<CoachTemplateVariable, "input">, string>;

/**
 * What the model receives: one system message (personality, instructions, format), then the
 * conversation, each message of the member going through the data prompt ({{input}}).
 * Consecutive messages of the same author are merged (a member may write again after a failed
 * answer), and the conversation starts with the member, as Gemini expects.
 */
export function buildCoachMessages(pipeline: AiPipelineUpdate, variables: SystemVariables, history: Turn[]): ChatMessage[] {
  const system = [pipeline.system_prompt, pipeline.instructions_prompt, pipeline.output_format_prompt]
    .map((prompt) => renderTemplate(prompt, variables))
    .join("\n\n");

  const turns: ChatMessage[] = [];
  for (const message of history) {
    const content =
      message.role === "user" ? renderTemplate(pipeline.data_prompt, { ...variables, input: message.content }) : message.content;
    const previous = turns[turns.length - 1];
    if (previous?.role === message.role) previous.content += `\n\n${content}`;
    else turns.push({ role: message.role, content });
  }
  while (turns[0]?.role === "assistant") turns.shift();

  return [{ role: "system", content: system }, ...turns];
}

/** Saves a message, then moves its conversation to the top of the list (updated_at). */
async function saveMessage(db: SupabaseClient, userId: string, conversationId: string, role: CoachMessage["role"], content: string) {
  const saved = await db
    .from("coach_messages")
    .insert({ conversation_id: conversationId, user_id: userId, role, content })
    .select(COACH_MESSAGE_COLUMNS)
    .single();
  if (saved.error) throw saved.error;
  const message = saved.data as CoachMessage;

  const touched = await db
    .from("coach_conversations")
    .update({ updated_at: message.created_at })
    .eq("id", conversationId)
    .select(COACH_CONVERSATION_COLUMNS)
    .single();
  if (touched.error) throw touched.error;
  return { message, conversation: touched.data as CoachConversation };
}

/** Writes one event of the NDJSON stream (sending the headers first), unless the member left. */
function streamEvent(res: Response, event: CoachStreamEvent) {
  if (res.writableEnded || res.destroyed || !res.socket || res.socket.destroyed) return;
  if (!res.headersSent) {
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    // No proxy buffering nor transformation: every line must reach the browser at once.
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
  }
  res.write(`${JSON.stringify(event)}\n`);
}

const todayFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "Europe/Paris" });

/** Discussions with the coach Gus (/discussions), answered by the `coach` pipeline through OneShotAPI. */
export function registerCoachRoutes(app: Express) {
  // ONESHOTAPI_KEY: name used by some existing .env files.
  const apiKey = process.env.ONESHOT_API_KEY || process.env.ONESHOTAPI_KEY;
  const oneshot = apiKey ? new OneShotClient(apiKey) : null;
  if (!oneshot) logger.warn("ONESHOT_API_KEY missing: the coach answers 503");

  app.post(
    coachApi.messages.path,
    requireSubscriber,
    asyncRoute(async (req, res) => {
      if (!oneshot) throw new HttpError(503, "Gus n'est pas disponible sur ce serveur pour le moment.");
      const userId = getUserId(res);
      const body = parseInput(coachSendBodySchema, req.body);
      // requireSubscriber answers 503 when Supabase is not configured, so the client is set here.
      const db = supabaseAdmin!;

      let pipeline: AiPipelineUpdate;
      try {
        pipeline = await new AiPipelineRepository(db).get(AI_PIPELINE_SLUGS.coach);
      } catch (err) {
        if (err instanceof AiPipelineNotFoundError) {
          logger.error({ err }, "Coach pipeline missing: run section 7 of supabase_setup.sql");
          throw new HttpError(503, "Gus n'est pas encore configuré sur ce serveur.");
        }
        throw err;
      }

      const [saas, profile] = await Promise.all([
        db.from("saas").select("name").eq("id", body.saasId).eq("user_id", userId).maybeSingle(),
        db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      ]);
      if (saas.error || profile.error) {
        logger.error({ err: saas.error ?? profile.error }, "Failed to load the coach context");
        throw new HttpError(500, "Impossible de joindre Gus pour le moment.");
      }
      if (!saas.data) throw new HttpError(404, "Ce SaaS est introuvable.");

      // Everything Gus knows about the member and this SaaS, read while the conversation loads.
      const context = buildCoachContext(db, userId, body.saasId);

      let conversation: CoachConversation | null = null;
      let history: Turn[] = [];
      // The conversation locked in `answering` by this request, released at the end.
      let lockedId: string | null = null;

      try {
        // An existing conversation: it must be the member's, in this SaaS, and not being answered.
        if (body.conversationId) {
          const found = await db
            .from("coach_conversations")
            .select(COACH_CONVERSATION_COLUMNS)
            .eq("id", body.conversationId)
            .eq("user_id", userId)
            .eq("saas_id", body.saasId)
            .maybeSingle();
          if (found.error) {
            logger.error({ err: found.error }, "Failed to load the coach conversation");
            throw new HttpError(500, "Impossible de charger cette discussion.");
          }
          if (!found.data) throw new HttpError(404, "Cette discussion est introuvable.");
          conversation = found.data as CoachConversation;
          if (answering.has(conversation.id)) throw new HttpError(409, "Gus est déjà en train de répondre dans cette discussion.");
          answering.add(conversation.id);
          lockedId = conversation.id;

          const latest = await db
            .from("coach_messages")
            .select("role, content")
            .eq("conversation_id", conversation.id)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(COACH_HISTORY_MESSAGES);
          if (latest.error) {
            logger.error({ err: latest.error }, "Failed to load the coach history");
            throw new HttpError(500, "Impossible de charger cette discussion.");
          }
          history = (latest.data as Turn[]).reverse();
        }

        // Without a new message, Gus answers again the last one (its answer failed).
        if (body.content === null && history[history.length - 1]?.role !== "user") {
          throw new HttpError(409, "Gus a déjà répondu à ton dernier message.");
        }
        if (!takeMessageSlot(userId)) {
          throw new HttpError(429, "Tu as envoyé beaucoup de messages à Gus. Réessaie dans quelques minutes.");
        }

        const isNew = !conversation;
        if (!conversation) {
          const created = await db
            .from("coach_conversations")
            .insert({ user_id: userId, saas_id: body.saasId, title: conversationTitleFrom(body.content!) })
            .select(COACH_CONVERSATION_COLUMNS)
            .single();
          if (created.error) {
            logger.error({ err: created.error }, "Failed to create the coach conversation");
            throw new HttpError(500, "Impossible de créer la discussion.");
          }
          conversation = created.data as CoachConversation;
          answering.add(conversation.id);
          lockedId = conversation.id;
        }
        const conversationId = conversation.id;

        let userMessage: CoachMessage | null = null;
        if (body.content !== null) {
          try {
            ({ message: userMessage, conversation } = await saveMessage(db, userId, conversationId, "user", body.content));
          } catch (err) {
            logger.error({ err }, "Failed to save the member's message");
            // A new conversation without its first message would stay empty in the list.
            if (isNew) await db.from("coach_conversations").delete().eq("id", conversationId);
            throw new HttpError(500, "Impossible d'envoyer ton message, réessaie.");
          }
          history = [...history, userMessage].slice(-COACH_HISTORY_MESSAGES);
        }

        streamEvent(res, { type: "start", conversation, userMessage });

        const variables: SystemVariables = {
          prenom: profile.data?.full_name?.trim().split(/\s+/)[0] || "inconnu",
          saas: saas.data.name,
          date: todayFormatter.format(new Date()),
          ...(await context),
        };

        // The model keeps generating (and billing) when the member leaves: the answer is read to
        // the end and saved anyway, they find it in the conversation when they come back.
        let answer = "";
        try {
          const messages = buildCoachMessages(pipeline, variables, history);
          for await (const delta of oneshot.streamChat({ model: pipeline.model, messages })) {
            answer += delta;
            streamEvent(res, { type: "delta", text: delta });
          }
          answer = answer.trim();
          if (!answer) throw new OneShotError("empty_result", "OneShotAPI chat returned an empty answer");
        } catch (err) {
          logger.error({ err, conversationId }, "Coach answer failed");
          streamEvent(res, { type: "error", message: "Gus n'a pas pu répondre. Réessaie dans un instant." });
          return;
        }

        try {
          streamEvent(res, { type: "done", ...(await saveMessage(db, userId, conversationId, "assistant", answer)) });
        } catch (err) {
          logger.error({ err, conversationId }, "Failed to save the coach answer");
          streamEvent(res, { type: "error", message: "La réponse de Gus n'a pas pu être enregistrée. Réessaie." });
        }
      } finally {
        if (lockedId) answering.delete(lockedId);
        // Errors before the stream started are answered by the error handler (HTTP status + JSON).
        if (res.headersSent && !res.writableEnded) res.end();
      }
    }),
  );
}
