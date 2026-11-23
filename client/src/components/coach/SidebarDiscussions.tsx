import { useState } from "react";
import { Link } from "wouter";
import { MessagesSquare, MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";
import type { CoachConversation } from "@shared/coach";
import type { NavGroupContentProps } from "@/components/layout/AppSidebar";
import { navLinkClass, navSubLinkClass } from "@/components/layout/nav-styles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton } from "@/components/ui/sidebar";
import { COACH_PATH, conversationPath, useCoachConversations, useLiveTurn } from "@/hooks/use-coach";
import { cn } from "@/lib/utils";
import { DiscussionDialogs, type DiscussionDialogState } from "./DiscussionDialogs";
import { DiscussionsHistory } from "./DiscussionsHistory";

/** Latest discussions listed in the sidebar; "Voir tout" opens all of them when there are more. */
const RECENT_DISCUSSIONS = 3;

function RecentDiscussion({
  conversation,
  active,
  onOpenDialog,
}: {
  conversation: CoachConversation;
  active: boolean;
  onOpenDialog: (state: Exclude<DiscussionDialogState, null>) => void;
}) {
  // Gus is answering in this discussion (possibly while the member is elsewhere).
  const answering = !!useLiveTurn(conversation.id);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} className={`${navSubLinkClass} px-2.5 pr-9`}>
        <Link href={conversationPath(conversation.id)} title={conversation.title}>
          <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
          {answering && <span aria-label="Gus répond" className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Options de « ${conversation.title} »`}
            className={cn(
              "absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[6px] text-sidebar-foreground/50 transition-opacity",
              "hover:bg-white/[0.06] hover:text-sidebar-foreground focus-visible:opacity-100 data-[state=open]:opacity-100",
              // Always visible on touch screens, on hover (or for the open one) with a mouse.
              "md:opacity-0 md:group-hover/menu-item:opacity-100",
              active && "md:opacity-100",
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-44">
          <DropdownMenuItem onSelect={() => onOpenDialog({ mode: "rename", conversation })}>
            <Pencil /> Renommer
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onOpenDialog({ mode: "delete", conversation })}>
            <Trash2 /> Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/**
 * "Discussions" category of the sidebar (AppSidebar): the latest discussions of the active SaaS,
 * each renamable and deletable from its "…" menu; the open one stays listed even when it is older,
 * and "Voir tout" opens every discussion (searchable, by date) when there are more. Collapsed to
 * icons, a single icon opens that list. A new discussion starts from "Nouvelle discussion" at the
 * top of the list, or from "Discuter avec Gus" in the header (TalkToGusButton).
 */
export function SidebarDiscussions({ isCollapsed, currentPath }: NavGroupContentProps) {
  const conversations = useCoachConversations();
  const [allOpen, setAllOpen] = useState(false);
  const [dialog, setDialog] = useState<DiscussionDialogState>(null);

  const list = conversations.data ?? [];
  const recent = list.slice(0, RECENT_DISCUSSIONS);
  const open = list.find((conversation) => conversationPath(conversation.id) === currentPath);
  if (open && !recent.includes(open)) recent.push(open);

  const allDiscussions = <DiscussionsHistory open={allOpen} onOpenChange={setAllOpen} currentPath={currentPath} />;

  const isNewDiscussion = currentPath === COACH_PATH;

  if (isCollapsed) {
    return (
      <>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isNewDiscussion} tooltip="Nouvelle discussion" className={navLinkClass}>
              <Link href={COACH_PATH} aria-label="Nouvelle discussion">
                <SquarePen />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={currentPath.startsWith(`${COACH_PATH}/`)}
              tooltip="Discussions"
              onClick={() => setAllOpen(true)}
              className={navLinkClass}
            >
              <MessagesSquare />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {allDiscussions}
      </>
    );
  }

  return (
    <>
      <SidebarMenu className="gap-0.5">
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isNewDiscussion} className={`${navSubLinkClass} px-3`}>
            <Link href={COACH_PATH} data-testid="link-new-discussion">
              <SquarePen />
              <span>Nouvelle discussion</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* The history hangs from a thin line under the "Nouvelle discussion" icon (like the
            sub-pages of a folder in AppSidebar): a list of its own, below the action. Without any
            discussion yet, nothing hangs there. */}
        {(conversations.isLoading || recent.length > 0) && (
          <li>
            <ul aria-label="Discussions récentes" className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-white/[0.08] pl-2">
              {conversations.isLoading
                ? [0, 1, 2].map((i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton className="h-9" />
                    </SidebarMenuItem>
                  ))
                : recent.map((conversation) => (
                    <RecentDiscussion key={conversation.id} conversation={conversation} active={conversation === open} onOpenDialog={setDialog} />
                  ))}

              {list.length > RECENT_DISCUSSIONS && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setAllOpen(true)} className={`${navSubLinkClass} px-2.5 text-sidebar-foreground/45`}>
                    Voir tout ({list.length})
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </ul>
          </li>
        )}
      </SidebarMenu>

      {allDiscussions}
      <DiscussionDialogs state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
