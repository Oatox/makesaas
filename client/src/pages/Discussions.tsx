import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { navigate } from "wouter/use-browser-location";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  Lightbulb,
  Loader2,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { ChatComposer } from "@/components/coach/ChatComposer";
import { ChatThread } from "@/components/coach/ChatThread";
import { DiscussionDialogs, type DiscussionDialogState } from "@/components/coach/DiscussionDialogs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { NoSaasState } from "@/components/saas/NoSaasState";
import { ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  COACH_PATH,
  CoachAnswerError,
  coachKeys,
  NEW_CONVERSATION,
  sendToCoach,
  useCoachConversations,
  useCoachMessages,
  useLiveTurn,
} from "@/hooks/use-coach";
import { useSaas } from "@/hooks/use-saas";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { translateSupabaseError } from "@/lib/error-translator";
import { queryClient } from "@/lib/queryClient";

/** First questions offered on a new discussion: a click sends them. */
const SUGGESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Lightbulb, text: "Aide-moi à trouver une idée de SaaS rentable" },
  { icon: Users, text: "Comment trouver mes 10 premiers clients ?" },
  { icon: Tag, text: "À quel prix vendre mon offre ?" },
  { icon: CalendarCheck, text: "Par quoi je commence cette semaine ?" },
];

/** Sends a message (or a retry, `content: null`) and reports failures; false: refused, give the text back. */
function useSend(saasId: string, conversationId: string | null) {
  const { toast } = useToast();
  return async (content: string | null): Promise<boolean> => {
    try {
      await sendToCoach({ saasId, conversationId, content });
      return true;
    } catch (error) {
      if (error instanceof CoachAnswerError) {
        // The message was saved: the thread offers to retry.
        toast({ variant: "destructive", title: "Réponse interrompue", description: error.message });
        return true;
      }
      // Already answering, or answered meanwhile (another tab): show the latest state.
      if (error instanceof ApiError && error.status === 409 && conversationId) {
        void queryClient.invalidateQueries({ queryKey: coachKeys.messages(conversationId) });
      }
      toast({ variant: "destructive", ...translateSupabaseError(error, "Message non envoyé") });
      return false;
    }
  };
}

/**
 * Keeps a scrolling area at the bottom while new content comes in, unless the member scrolled up
 * to read. `follow()` sticks it to the bottom again (after sending a message).
 */
function useStickToBottom(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);

  const onScroll = () => {
    const element = ref.current;
    if (element) stuck.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  };

  useLayoutEffect(() => {
    const element = ref.current;
    if (element && stuck.current) element.scrollTop = element.scrollHeight;
  }, deps);

  return { ref, onScroll, follow: () => void (stuck.current = true) };
}

function Disclaimer() {
  return <p className="mt-2 text-center text-xs text-muted-foreground/80">{COACH_NAME} peut se tromper : vérifie les informations importantes.</p>;
}

/** /discussions: Gus introduces himself and suggests a few questions; the first message creates the discussion. */
function NewConversation({ saasId, saasName }: { saasId: string; saasName: string }) {
  const { profile } = useAuth();
  const live = useLiveTurn(NEW_CONVERSATION);
  const send = useSend(saasId, null);
  const scroll = useStickToBottom([live?.pendingContent, live?.answer]);
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  const sendNow = (content: string) => {
    scroll.follow();
    return send(content);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroll.ref} onScroll={scroll.onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {live ? (
          // The first message is on its way: the discussion's page opens as soon as it is created.
          <div className="mx-auto w-full max-w-3xl px-1 py-4">
            <ChatThread messages={[]} live={live} />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-1 py-8 text-center"
          >
            <CoachAvatar online className="h-16 w-16" />
            <h2 className="mt-5 font-display text-2xl font-light tracking-tight sm:text-3xl">
              {firstName ? `Salut ${firstName}, de quoi on parle ?` : "De quoi on parle ?"}
            </h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              Je suis {COACH_NAME}, ton coach. Pose-moi tes questions sur {saasName} : idée, offre, prix, clients, vente…
            </p>
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => void sendNow(text)}
                  className="flex items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3 text-left text-sm text-foreground/80 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  {text}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl pt-3">
        <ChatComposer onSend={sendNow} busy={!!live} autoFocus />
        <Disclaimer />
      </div>
    </div>
  );
}

/** /discussions/:id: the messages, Gus's answer as it comes, and the field for the next message. */
function Conversation({ saasId, conversationId }: { saasId: string; conversationId: string }) {
  const messages = useCoachMessages(conversationId);
  const conversations = useCoachConversations();
  const live = useLiveTurn(conversationId);
  const send = useSend(saasId, conversationId);
  const scroll = useStickToBottom([messages.data, live?.pendingContent, live?.answer]);

  // Not a discussion of the active SaaS (another SaaS was picked, or it was deleted): start a new one.
  const known = conversations.data?.some((conversation) => conversation.id === conversationId);
  useEffect(() => {
    if (conversations.data && !known && !live) navigate(COACH_PATH, { replace: true });
  }, [conversations.data, known, live]);

  const sendNow = (content: string | null) => {
    scroll.follow();
    return send(content);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroll.ref} onScroll={scroll.onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-1 py-4">
          {messages.isPending ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.isError ? (
            <ErrorState
              title="Impossible de charger cette discussion"
              message="Vérifie ta connexion internet puis réessaie."
              action={<Button onClick={() => void messages.refetch()}>Réessayer</Button>}
            />
          ) : (
            <ChatThread messages={messages.data} live={live} onRetry={() => void sendNow(null)} />
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl pt-3">
        <ChatComposer onSend={sendNow} busy={!!live} disabled={!messages.isSuccess} autoFocus />
        <Disclaimer />
      </div>
    </div>
  );
}

/**
 * Header of an open discussion: a menu to rename or delete it (handy for an old one found in the
 * history). A new discussion starts from "Discuter avec Gus", next to it in every page's header.
 */
function ConversationActions({ conversationId }: { conversationId: string }) {
  const conversation = useCoachConversations().data?.find((item) => item.id === conversationId);
  const [dialog, setDialog] = useState<DiscussionDialogState>(null);

  return (
    <HeaderActions>
      {conversation && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Options de la discussion">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => setDialog({ mode: "rename", conversation })}>
              <Pencil /> Renommer
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ mode: "delete", conversation })}>
              <Trash2 /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DiscussionDialogs state={dialog} onClose={() => setDialog(null)} />
    </HeaderActions>
  );
}

/**
 * Discussions with the coach Gus (/discussions, /discussions/:id) for the active SaaS: a new one or
 * the open one. They are listed in their own category of the sidebar (SidebarDiscussions).
 * The layout gives this page the full height (AppLayout): it scrolls its own areas.
 */
export default function Discussions() {
  const [, params] = useRoute<{ id: string }>(`${COACH_PATH}/:id`);
  const conversationId = params?.id;
  const saas = useSaas();

  if (saas.isError) {
    return (
      <ErrorState
        title="Impossible de charger tes SaaS"
        message="Vérifie ta connexion internet puis réessaie."
        action={<Button onClick={saas.retry}>Réessayer</Button>}
      />
    );
  }
  if (!saas.currentSaas) {
    return saas.isLoading ? (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    ) : (
      // Discussions belong to a SaaS: without one yet, invite to create it.
      <NoSaasState description={`Tes discussions avec ${COACH_NAME} sont rangées par SaaS. Crée le tien, puis pose-lui ta première question.`} />
    );
  }

  const { id: saasId, name: saasName } = saas.currentSaas;

  return conversationId ? (
    <>
      <ConversationActions conversationId={conversationId} />
      {/* Keyed: another discussion starts with its own scroll position and field. */}
      <Conversation key={conversationId} saasId={saasId} conversationId={conversationId} />
    </>
  ) : (
    <NewConversation key={saasId} saasId={saasId} saasName={saasName} />
  );
}
