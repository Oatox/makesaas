import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { navigate } from "wouter/use-browser-location";
import { Loader2, MessageSquare, SquarePen } from "lucide-react";
import type { CoachConversation } from "@shared/coach";
import { COACH_NAME } from "@/components/brand/Coach";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COACH_PATH, conversationPath, useCoachConversations, useLiveTurn } from "@/hooks/use-coach";
import { cn } from "@/lib/utils";

/** "Aujourd'hui", "Hier", "7 derniers jours", "30 derniers jours", then one group per month. */
function groupLabel(date: Date, now: Date) {
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return "7 derniers jours";
  if (days < 30) return "30 derniers jours";
  const month = format(date, "MMMM yyyy", { locale: fr });
  return month.charAt(0).toUpperCase() + month.slice(1);
}

/** When the discussion was last active: the time today, the day this week, the date before. */
function formatWhen(date: Date, now: Date) {
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return format(date, "HH:mm");
  if (days === 1) return "Hier";
  if (days < 7) return format(date, "EEEE", { locale: fr });
  return format(date, date.getFullYear() === now.getFullYear() ? "d MMM" : "d MMM yyyy", { locale: fr });
}

/** Discussions grouped by last activity, latest first (the list already comes sorted). */
function groupByActivity(conversations: CoachConversation[]) {
  const now = new Date();
  const groups: { label: string; items: { conversation: CoachConversation; when: string }[] }[] = [];
  for (const conversation of conversations) {
    const date = new Date(conversation.updated_at);
    const label = groupLabel(date, now);
    const item = { conversation, when: formatWhen(date, now) };
    const group = groups[groups.length - 1];
    if (group?.label === label) group.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/** Search ignoring case and accents ("strategie" finds "Stratégie"). */
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function HistoryItem({
  conversation,
  when,
  active,
  onOpen,
}: {
  conversation: CoachConversation;
  when: string;
  active: boolean;
  onOpen: () => void;
}) {
  const answering = !!useLiveTurn(conversation.id);
  return (
    <CommandItem
      value={conversation.id}
      keywords={[conversation.title]}
      onSelect={onOpen}
      className="cursor-pointer gap-3 rounded-[10px] px-3 py-2.5 data-[selected=true]:bg-white/[0.06]"
    >
      <MessageSquare className={cn("text-muted-foreground", active && "text-primary")} />
      <span className={cn("min-w-0 flex-1 truncate", active && "font-medium")}>{conversation.title}</span>
      {answering ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {COACH_NAME} répond
        </span>
      ) : (
        <span className="shrink-0 text-xs capitalize text-muted-foreground">{when}</span>
      )}
    </CommandItem>
  );
}

/**
 * Every discussion of the active SaaS, to find an old one: searchable by title, grouped by date.
 * Opened from "Voir tout" in the sidebar, or its icon when collapsed (SidebarDiscussions).
 */
export function DiscussionsHistory({
  open,
  onOpenChange,
  currentPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
}) {
  const conversations = useCoachConversations();
  const list = conversations.data ?? [];

  const openPath = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
        // No keyboard popping up over the list on phones: the search is one tap away.
        onOpenAutoFocus={(event) => {
          if (!window.matchMedia("(pointer: fine)").matches) event.preventDefault();
        }}
      >
        <DialogHeader className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle>Toutes les discussions</DialogTitle>
          <DialogDescription>
            {list.length > 0
              ? `${list.length} discussion${list.length > 1 ? "s" : ""} avec ${COACH_NAME}, de la plus récente à la plus ancienne.`
              : `Tes discussions avec ${COACH_NAME} apparaîtront ici.`}
          </DialogDescription>
        </DialogHeader>

        {conversations.isLoading ? (
          <div className="flex justify-center border-t border-border py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Pose ta première question à {COACH_NAME} pour démarrer.
            <Button size="sm" onClick={() => openPath(COACH_PATH)}>
              <SquarePen />
              Nouvelle discussion
            </Button>
          </div>
        ) : (
          <Command
            className="rounded-none bg-transparent"
            filter={(_value, search, keywords) => (normalize(keywords?.join(" ") ?? "").includes(normalize(search.trim())) ? 1 : 0)}
          >
            <div className="border-t border-border [&_[cmdk-input-wrapper]]:border-b-0 [&_[cmdk-input-wrapper]]:px-5 sm:[&_[cmdk-input-wrapper]]:px-6">
              <CommandInput placeholder="Rechercher une discussion…" className="h-12 text-base md:text-sm" />
            </div>
            <CommandList className="max-h-[min(60vh,460px)] border-t border-border px-2 pb-2 sm:px-3">
              <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">Aucune discussion ne correspond.</CommandEmpty>
              {groupByActivity(list).map((group) => (
                <CommandGroup
                  key={group.label}
                  heading={group.label}
                  className="pt-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.04em] [&_[cmdk-group-heading]]:text-muted-foreground/70"
                >
                  {group.items.map(({ conversation, when }) => (
                    <HistoryItem
                      key={conversation.id}
                      conversation={conversation}
                      when={when}
                      active={conversationPath(conversation.id) === currentPath}
                      onOpen={() => openPath(conversationPath(conversation.id))}
                    />
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  );
}
