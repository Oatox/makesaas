import { useMutation, useQuery } from "@tanstack/react-query";
import { navigate } from "wouter/use-browser-location";
import {
  COACH_CONVERSATION_COLUMNS,
  COACH_MESSAGE_COLUMNS,
  coachApi,
  type CoachConversation,
  type CoachMessage,
  type CoachSendBody,
  type CoachStreamEvent,
} from "@shared/coach";
import { supabase } from "@/lib/supabase";
import { apiStream } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { useCurrentSaasId } from "./use-saas";

/** Discussions with Gus: /discussions starts a new one, /discussions/:id opens one. */
export const COACH_PATH = "/discussions";
export const conversationPath = (id: string) => `${COACH_PATH}/${id}`;

export const coachKeys = {
  // Per SaaS: switching SaaS (sidebar) loads the other SaaS's conversations.
  conversations: (saasId: string | undefined) => ["coach", "conversations", saasId] as const,
  messages: (conversationId: string | undefined) => ["coach", "messages", conversationId] as const,
  // Client-only state, never fetched (see useLiveTurn).
  live: (key: string) => ["coach-live", key] as const,
};

/** Key of the live turn of a discussion not created yet (its first message is on its way). */
export const NEW_CONVERSATION = "new";

/**
 * A turn being answered: the member's message until the server saved it, then Gus's answer as it
 * streams in. Kept in the query cache (not in a component) so that it survives a change of page,
 * and so that the saved answer replaces it in the same render.
 */
export type LiveTurn = { pendingContent: string | null; answer: string };

const getLiveTurn = (key: string) => queryClient.getQueryData<LiveTurn | null>(coachKeys.live(key)) ?? null;
const setLiveTurn = (key: string, turn: LiveTurn | null) => queryClient.setQueryData(coachKeys.live(key), turn);

/** The live turn of a conversation (NEW_CONVERSATION for the new discussion screen), or null. */
export function useLiveTurn(key: string): LiveTurn | null {
  const { data } = useQuery({ queryKey: coachKeys.live(key), queryFn: () => getLiveTurn(key), enabled: false });
  return data ?? null;
}

const byLastActivity = (a: CoachConversation, b: CoachConversation) => b.updated_at.localeCompare(a.updated_at);

/** Adds or updates a conversation in its SaaS's list, latest activity first. */
function upsertConversation(conversation: CoachConversation) {
  const key = coachKeys.conversations(conversation.saas_id);
  // Never seed a list that was not loaded yet: it would then hold this conversation only.
  if (!queryClient.getQueryData(key)) return void queryClient.invalidateQueries({ queryKey: key });
  queryClient.setQueryData<CoachConversation[]>(key, (previous = []) =>
    [conversation, ...previous.filter((item) => item.id !== conversation.id)].sort(byLastActivity),
  );
}

/** Adds a saved message to its conversation (a fetch in flight would otherwise overwrite it). */
function appendMessage(message: CoachMessage, isNewConversation = false) {
  const key = coachKeys.messages(message.conversation_id);
  void queryClient.cancelQueries({ queryKey: key });
  if (isNewConversation) return queryClient.setQueryData<CoachMessage[]>(key, [message]);
  if (!queryClient.getQueryData(key)) return void queryClient.invalidateQueries({ queryKey: key });
  queryClient.setQueryData<CoachMessage[]>(key, (previous = []) => [...previous.filter((item) => item.id !== message.id), message]);
}

/** An answer of Gus that failed: its message (French) can be shown as is. */
export class CoachAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoachAnswerError";
  }
}

/**
 * Sends a message to Gus (`content`), or asks him to answer again the last one (`content: null`),
 * and follows his answer until it is saved. A new discussion (`conversationId: null`) opens its
 * page as soon as the server created it, if the member is still on the new discussion screen.
 * Throws ApiError when the message was refused, CoachAnswerError when the answer failed.
 */
export async function sendToCoach(body: CoachSendBody): Promise<void> {
  let key = body.conversationId ?? NEW_CONVERSATION;
  setLiveTurn(key, { pendingContent: body.content, answer: "" });
  let finished = false;

  try {
    for await (const event of apiStream<CoachStreamEvent>(coachApi.messages.path, { method: "POST", body })) {
      if (event.type === "start") {
        const { conversation, userMessage } = event;
        upsertConversation(conversation);
        if (userMessage) appendMessage(userMessage, !body.conversationId);
        setLiveTurn(key, null);
        key = conversation.id;
        setLiveTurn(key, { pendingContent: null, answer: "" });
        if (!body.conversationId && window.location.pathname === COACH_PATH) {
          navigate(conversationPath(conversation.id), { replace: true });
        }
      } else if (event.type === "delta") {
        const live = getLiveTurn(key);
        setLiveTurn(key, { pendingContent: live?.pendingContent ?? null, answer: (live?.answer ?? "") + event.text });
      } else if (event.type === "done") {
        upsertConversation(event.conversation);
        appendMessage(event.message);
        finished = true;
      } else {
        throw new CoachAnswerError(event.message);
      }
    }
    if (!finished) {
      throw new CoachAnswerError("La connexion a été coupée. Si Gus a terminé sa réponse, elle apparaîtra dans un instant.");
    }
  } finally {
    setLiveTurn(key, null);
    // The server finishes and saves the answer even when the stream broke: reload it.
    if (!finished && key !== NEW_CONVERSATION) {
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: coachKeys.messages(key) }), 3_000);
    }
  }
}

/** Conversations of the active SaaS, latest activity first (read straight from Supabase, RLS). */
export function useCoachConversations() {
  const saasId = useCurrentSaasId();
  return useQuery({
    queryKey: coachKeys.conversations(saasId),
    queryFn: async (): Promise<CoachConversation[]> => {
      const { data, error } = await supabase
        .from("coach_conversations")
        .select(COACH_CONVERSATION_COLUMNS)
        .eq("saas_id", saasId!)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as CoachConversation[];
    },
    enabled: !!saasId,
  });
}

/** Messages of a conversation, oldest first. */
export function useCoachMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: coachKeys.messages(conversationId),
    queryFn: async (): Promise<CoachMessage[]> => {
      const { data, error } = await supabase
        .from("coach_messages")
        .select(COACH_MESSAGE_COLUMNS)
        .eq("conversation_id", conversationId!)
        .order("created_at");
      if (error) throw error;
      return data as CoachMessage[];
    },
    enabled: !!conversationId,
  });
}

export function useRenameConversation() {
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { data, error } = await supabase
        .from("coach_conversations")
        .update({ title })
        .eq("id", id)
        .select(COACH_CONVERSATION_COLUMNS)
        .single();
      if (error) throw error;
      return data as CoachConversation;
    },
    onSuccess: upsertConversation,
  });
}

/** Deletes a conversation and its messages (ON DELETE CASCADE). */
export function useDeleteConversation() {
  return useMutation({
    mutationFn: async (conversation: CoachConversation) => {
      const { error } = await supabase.from("coach_conversations").delete().eq("id", conversation.id);
      if (error) throw error;
      return conversation;
    },
    onSuccess: (conversation) => {
      queryClient.setQueryData<CoachConversation[]>(coachKeys.conversations(conversation.saas_id), (previous) =>
        previous?.filter((item) => item.id !== conversation.id),
      );
      queryClient.removeQueries({ queryKey: coachKeys.messages(conversation.id) });
      if (window.location.pathname === conversationPath(conversation.id)) navigate(COACH_PATH, { replace: true });
    },
  });
}
