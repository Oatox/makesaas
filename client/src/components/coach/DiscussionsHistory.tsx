import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Command as CommandPrimitive } from "cmdk";
import { navigate } from "wouter/use-browser-location";
import { Loader2, Search, SquarePen } from "lucide-react";
import type { CoachConversation } from "@shared/coach";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { COACH_PATH, conversationPath, useCoachConversations, useLiveTurn } from "@/hooks/use-coach";
import { fieldClass } from "@/lib/field-styles";
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

/**
 * When the discussion was last active, as precise as its group leaves useful: the time today and
 * yesterday, the day this week, the date before.
 */
function formatWhen(date: Date, now: Date) {
  const days = differenceInCalendarDays(now, date);
  if (days <= 1) return format(date, "HH:mm");
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

// Group labels like the sidebar's categories (AppSidebar).
const groupClass =
  "p-0 pt-4 first:pt-1 [&_[cmdk-group-items]]:space-y-0.5 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-0 " +
  "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase " +
  "[&_[cmdk-group-heading]]:tracking-[0.04em] [&_[cmdk-group-heading]]:text-muted-foreground/60";

// Rows like the sidebar's links (layout/nav-styles.ts): muted at rest, a light wash under the pointer
// or the arrow keys, and the open discussion with the active link's fill.
const itemClass =
  "h-10 cursor-pointer gap-3 rounded-[10px] border border-transparent px-3 py-0 text-sm font-medium text-foreground/70 " +
  "transition-colors duration-100 data-[selected='true']:bg-white/[0.05] data-[selected=true]:text-foreground";

const activeItemClass =
  "border-white/[0.09] bg-white/[0.07] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] data-[selected='true']:bg-white/[0.07]";

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
      aria-current={active ? "page" : undefined}
      className={cn(itemClass, active && activeItemClass)}
    >
      <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
      {answering ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-normal text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {COACH_NAME} répond
        </span>
      ) : (
        <span className="shrink-0 text-xs font-normal capitalize tabular-nums text-muted-foreground/70">{when}</span>
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
  // The keyboard starts on the open discussion, so a single row stands out when the list opens.
  const openId = list.find((conversation) => conversationPath(conversation.id) === currentPath)?.id;

  const openPath = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-xl sm:p-0"
        // No keyboard popping up over the list on phones: the search is one tap away.
        onOpenAutoFocus={(event) => {
          if (!window.matchMedia("(pointer: fine)").matches) event.preventDefault();
        }}
      >
        {/* Gus and the count, like the header of a SaaS's settings (room on the right for the close
            button). */}
        <div className="flex items-center gap-3 px-5 pb-4 pr-14 pt-5 sm:px-6 sm:pr-16">
          <CoachAvatar className="size-9" />
          <div className="min-w-0">
            <DialogTitle className="truncate font-sans text-[15px] font-semibold tracking-normal">Discussions avec {COACH_NAME}</DialogTitle>
            <DialogDescription className="text-xs">
              {list.length > 0 ? `${list.length} discussion${list.length > 1 ? "s" : ""}` : "Aucune discussion pour l'instant"}
            </DialogDescription>
          </div>
        </div>

        {conversations.isLoading ? (
          <div className="flex justify-center pb-10 pt-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-4 text-center text-sm text-muted-foreground">
            Pose ta première question à {COACH_NAME} pour démarrer.
            <Button size="sm" onClick={() => openPath(COACH_PATH)}>
              <SquarePen />
              Nouvelle discussion
            </Button>
          </div>
        ) : (
          <Command
            className="rounded-none bg-transparent"
            defaultValue={openId}
            filter={(_value, search, keywords) => (normalize(keywords?.join(" ") ?? "").includes(normalize(search.trim())) ? 1 : 0)}
          >
            {/* The app's field, with the search icon inside. */}
            <div className="px-5 sm:px-6">
              <label className={cn(fieldClass, "flex h-11 cursor-text items-center gap-2.5 md:h-10")}>
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <CommandPrimitive.Input
                  placeholder="Rechercher une discussion…"
                  className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                />
              </label>
            </div>

            <CommandList className="scroll-thin max-h-[min(60vh,440px)] px-2.5 pb-3 pt-3 sm:px-3.5">
              <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">Aucune discussion ne correspond.</CommandEmpty>
              {groupByActivity(list).map((group) => (
                <CommandGroup key={group.label} heading={group.label} className={groupClass}>
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
