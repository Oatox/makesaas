import { z } from "zod";

/**
 * Discussions with the coach (/discussions): a member keeps conversations with Gus for each of their
 * SaaS. Tables public.coach_conversations and public.coach_messages (supabase_setup.sql, section 11):
 * the server (server/coach/) alone writes the messages, since it calls the model; members read their
 * conversations, rename and delete them straight from Supabase (RLS).
 *
 * Gus's prompts are the `coach` pipeline (shared/ai-pipeline.ts), edited by admins at /admin/pipeline.
 */

/** Mirrored by coach_messages_content_check in supabase_setup.sql (the model's answers are longer). */
export const COACH_MESSAGE_MAX_LENGTH = 4_000;

/** Mirrored by coach_conversations_title_check in supabase_setup.sql. */
export const COACH_TITLE_MAX_LENGTH = 80;

/**
 * Latest messages sent to the model on each turn (with the system message: OneShotAPI accepts 50
 * messages at most). Older ones stay in the conversation but Gus no longer sees them.
 */
export const COACH_HISTORY_MESSAGES = 40;

export type CoachRole = "user" | "assistant";

/** Row of public.coach_conversations as the client reads it. */
export type CoachConversation = {
  id: string;
  saas_id: string;
  title: string;
  created_at: string;
  /** Time of the last message: the list is sorted on it. */
  updated_at: string;
};

/** Row of public.coach_messages as the client reads it. */
export type CoachMessage = {
  id: string;
  conversation_id: string;
  role: CoachRole;
  content: string;
  created_at: string;
};

export const COACH_CONVERSATION_COLUMNS = "id, saas_id, title, created_at, updated_at";
export const COACH_MESSAGE_COLUMNS = "id, conversation_id, role, content, created_at";

/** Title of a new conversation: its first message, on one line, cut at a word. */
export function conversationTitleFrom(content: string): string {
  const line = content.replace(/\s+/g, " ").trim();
  if (line.length <= COACH_TITLE_MAX_LENGTH) return line;
  const cut = line.slice(0, COACH_TITLE_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > COACH_TITLE_MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export const coachTitleSchema = z.string().trim().min(1, "Le titre est vide").max(COACH_TITLE_MAX_LENGTH);

/**
 * POST body of coachApi.messages. Without `conversationId`, a new conversation starts with `content`.
 * Without `content`, Gus answers again the last message of the conversation (after a failed answer).
 */
export const coachSendBodySchema = z
  .object({
    saasId: z.string().uuid(),
    conversationId: z.string().uuid().nullable(),
    content: z.string().trim().min(1, "Le message est vide").max(COACH_MESSAGE_MAX_LENGTH).nullable(),
  })
  .refine((body) => body.conversationId !== null || body.content !== null, {
    message: "Une nouvelle discussion commence par un message",
  });
export type CoachSendBody = z.infer<typeof coachSendBodySchema>;

/**
 * What coachApi.messages streams back, one JSON object per line (NDJSON), once the request is
 * accepted (errors before that are plain JSON errors with their HTTP status):
 *   start (the conversation, and the member's message once saved) → delta… → done | error.
 * The answer is saved even if the member leaves before the end.
 */
export type CoachStreamEvent =
  | { type: "start"; conversation: CoachConversation; userMessage: CoachMessage | null }
  | { type: "delta"; text: string }
  | { type: "done"; conversation: CoachConversation; message: CoachMessage }
  | { type: "error"; message: string };

export const coachApi = {
  /** POST CoachSendBody, subscribers only: saves the member's message and streams Gus's answer. */
  messages: { path: "/api/coach/messages" },
} as const;
