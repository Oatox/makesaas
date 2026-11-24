import { useState } from "react";
import { AlertCircle, ArrowLeft, ChevronRight, MessageSquare } from "lucide-react";
import type { AdminDiscussionSummary, AdminSaasDetail } from "@shared/admin";
import { COACH_NAME } from "@/components/brand/Coach";
import { ChatThread } from "@/components/coach/ChatThread";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDiscussion } from "@/hooks/use-admin-profiles";
import { formatAgoShort, formatDateTime, formatInteger } from "@/lib/format";

const SHOWN_FIRST = 5;

const messagesLabel = (count: number) => `${formatInteger(count)} message${count > 1 ? "s" : ""}`;

/** "aujourd'hui à 21:00", "hier à 21:00", "le 22 novembre 2026 à 21:00": after "Commencée". */
function startedAt(iso: string) {
  const text = formatDateTime(iso);
  return /^\d/.test(text) ? `le ${text}` : text.charAt(0).toLowerCase() + text.slice(1);
}

/** The SaaS's discussions with Gus, latest activity first; a click opens one (DiscussionView). */
export function DiscussionList({
  discussions,
  onOpen,
}: {
  discussions: AdminSaasDetail["discussions"];
  onOpen: (discussion: AdminDiscussionSummary) => void;
}) {
  const [all, setAll] = useState(false);
  const { total, latest } = discussions;

  if (!latest.length) {
    return <p className="text-sm text-muted-foreground">Aucune discussion avec {COACH_NAME} pour l'instant.</p>;
  }

  const shown = all ? latest : latest.slice(0, SHOWN_FIRST);
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <ul className="divide-y divide-border/60">
        {shown.map((discussion) => (
          <li key={discussion.id}>
            <button
              type="button"
              onClick={() => onOpen(discussion)}
              className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none"
            >
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{discussion.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {messagesLabel(discussion.messages)} · {formatAgoShort(discussion.updatedAt)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
      {latest.length > SHOWN_FIRST && (
        <button
          type="button"
          onClick={() => setAll((value) => !value)}
          className="w-full border-t border-border/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
        >
          {all ? "Afficher moins" : `Voir les ${formatInteger(total)} discussions`}
        </button>
      )}
      {all && total > latest.length && (
        <p className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
          Les {formatInteger(latest.length)} plus récentes sont listées ici.
        </p>
      )}
    </div>
  );
}

/** One discussion, read as the member had it: their messages and Gus's answers. */
export function DiscussionView({
  userId,
  discussion,
  backLabel,
  onBack,
}: {
  userId: string;
  discussion: AdminDiscussionSummary;
  backLabel: string;
  onBack: () => void;
}) {
  const { data, error, refetch, isRefetching } = useAdminDiscussion(userId, discussion.id);

  return (
    <div className="space-y-6">
      <div className="space-y-3 pr-10">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 max-w-full text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="truncate">{backLabel}</span>
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Discussion avec {COACH_NAME}</p>
          <h2 className="mt-1 font-display text-2xl font-light leading-tight">{discussion.title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Commencée {startedAt(discussion.createdAt)} ·{" "}
            {messagesLabel(data?.thread.length ?? discussion.messages)}
          </p>
        </div>
      </div>

      {data ? (
        data.thread.length ? (
          <ChatThread messages={data.thread} live={null} />
        ) : (
          <p className="text-sm text-muted-foreground">Cette discussion n'a aucun message.</p>
        )
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Impossible de charger la discussion</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {error.message}
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-5">
          <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
          <Skeleton className="h-28 w-5/6 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
        </div>
      )}
    </div>
  );
}
