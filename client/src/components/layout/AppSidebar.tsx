import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import type { BackState } from "@/config/page-titles";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ShieldCheck,
  Users,
  LogOut,
  ChevronRight,
  ChevronsUpDown,
  Settings as SettingsIcon,
  Workflow,
  Megaphone,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import type { LucideIcon } from "lucide-react";
import { SidebarDiscussions } from "@/components/coach/SidebarDiscussions";
import { APP_PAGES } from "@/config/app-pages";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { COACH_PATH, useCoachConversations } from "@/hooks/use-coach";
import { cn } from "@/lib/utils";
import { navLinkClass, navSubPageLinkClass } from "./nav-styles";
import { SaasSwitcher } from "./SaasSwitcher";

type NavSubItem = { href: string; label: string; icon?: LucideIcon };
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: boolean;
  /** Sub-pages listed under the link, which then unfolds them instead of being a plain link. */
  children?: NavSubItem[];
};
/** What a category with its own content (instead of fixed links) receives. */
export type NavGroupContentProps = { isCollapsed: boolean; currentPath: string };
type NavGroup = { label: string; adminOnly?: boolean } & (
  | { items: NavItem[] }
  /** Links built at runtime, e.g. the member's discussions. */
  | { Content: React.ComponentType<NavGroupContentProps> }
);

// Single source for the sidebar navigation.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Application",
    // The app's pages (config/app-pages.ts), also presented by Gus at the end of /lancement.
    items: APP_PAGES,
  },
  // The active SaaS's discussions with Gus (a new one starts from the header, TalkToGusButton);
  // hidden until the first one (AppSidebar).
  { label: "Discussions", Content: SidebarDiscussions },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { href: "/admin", label: "Aperçu Admin", icon: ShieldCheck },
      { href: "/admin/users", label: "Utilisateurs", icon: Users, matchPrefix: true },
      { href: "/admin/pipeline", label: "Pipelines", icon: Workflow, matchPrefix: true },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone, matchPrefix: true },
    ],
  },
];

// The account menu at the bottom of the sidebar, in the look of its links (navLinkClass): muted at
// rest, a light wash on hover (and on keyboard focus, instead of the blue focus ring), and while its
// menu is open the active link's fill. The avatar's initials sit on the same neutral wash, without
// the orange kept for the active link.
const userMenuClass =
  "h-12 gap-3 rounded-[10px] border border-transparent px-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors duration-150 " +
  "hover:bg-white/[0.045] hover:text-sidebar-foreground " +
  "focus-visible:ring-0 focus-visible:bg-white/[0.045] focus-visible:text-sidebar-foreground " +
  "data-[state=open]:border-white/[0.09] data-[state=open]:bg-white/[0.07] data-[state=open]:text-sidebar-foreground " +
  "data-[state=open]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] data-[state=open]:hover:bg-white/[0.07] data-[state=open]:hover:text-sidebar-foreground";

// Collapsed to icons: the avatar alone, ringed on hover and while its menu is open (like the SaaS tile
// of SaasSwitcher).
const userMenuCollapsedClass =
  "flex size-8 shrink-0 items-center justify-center rounded-full outline-none ring-offset-2 ring-offset-sidebar " +
  "transition-[box-shadow,transform] duration-150 hover:ring-2 hover:ring-white/15 active:scale-95 " +
  "data-[state=open]:ring-2 data-[state=open]:ring-white/25 focus-visible:ring-2 focus-visible:ring-white/25";

const userAvatarFallbackClass = "rounded-full bg-white/[0.08] text-xs font-medium text-sidebar-foreground/80";

function NavLink({ item, active, isCollapsed }: { item: NavItem; active: boolean; isCollapsed: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={navLinkClass}>
        <Link href={item.href}>
          <item.icon />
          {!isCollapsed && <span>{item.label}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Gus's button, at the top of the sidebar under the SaaS switcher: opens a new discussion. A soft
 * card at rest so it reads as an action, not a page; collapsed to icons, Gus's face alone.
 */
function TalkToGusLink({ active, isCollapsed }: { active: boolean; isCollapsed: boolean }) {
  const label = `Discuter avec ${COACH_NAME}`;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={label}
          className={cn(
            navLinkClass,
            "border-white/[0.07] bg-white/[0.04] text-sidebar-foreground/85 hover:bg-white/[0.07]",
            "group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent",
          )}
        >
          <Link href={COACH_PATH} aria-label={label} data-testid="link-sidebar-talk-to-gus">
            {/* Collapsed: Gus's face alone, a bit larger and without the online dot (too small there).
                The label stays the last span even then (hidden): the button truncates its last span,
                which would clip the avatar's ring. */}
            <CoachAvatar className={isCollapsed ? "!size-7" : "!size-6"} online={!isCollapsed} />
            <span className={isCollapsed ? "sr-only" : undefined}>{label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * A link with sub-pages: clicking it unfolds them and opens the first one (when not already in the
 * section); it unfolds by itself on any of its pages. Collapsed to icons, the sub-pages are hidden,
 * so it is a plain link to the first one.
 */
function NavFolder({
  item,
  active,
  isCollapsed,
  currentPath,
}: {
  item: NavItem & { children: NavSubItem[] };
  active: boolean;
  isCollapsed: boolean;
  currentPath: string;
}) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (isCollapsed) return <NavLink item={{ ...item, href: item.children[0].href }} active={active} isCollapsed />;

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !active) navigate(item.children[0].href);
      }}
    >
      <SidebarMenuItem className="group/folder">
        <CollapsibleTrigger asChild>
          {/* Folded while on one of its pages: the parent carries the active style instead. */}
          <SidebarMenuButton isActive={active && !open} className={navLinkClass}>
            <item.icon />
            <span>{item.label}</span>
            <ChevronRight className="ml-auto !size-4 transition-transform duration-200 group-data-[state=open]/folder:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="ml-[21px] mr-0 mt-1 border-white/[0.08] pl-2.5 pr-0">
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton asChild isActive={currentPath === child.href} className={navSubPageLinkClass}>
                  <Link href={child.href}>
                    {child.icon && <child.icon />}
                    <span>{child.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { state, isMobile, setOpenMobile } = useSidebar();

  // On mobile the sidebar is a sheet: close it once a link (nav or dropdown) changes the route.
  useEffect(() => {
    setOpenMobile(false);
  }, [location, setOpenMobile]);

  const isCollapsed = state === "collapsed" && !isMobile;
  // Profile photo, else the one of the Google account (also when Google was linked to an email
  // account later: its photo is then only on the identity). Rendered with referrerPolicy="no-referrer":
  // Google photos (lh3.googleusercontent.com) are often refused when a Referer is sent.
  const googleIdentity = user?.identities?.find((identity) => identity.provider === "google")?.identity_data;
  const avatarUrl: string | null =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    googleIdentity?.avatar_url ||
    googleIdentity?.picture ||
    null;
  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.email || user?.email || "Utilisateur";
  const displayEmail = profile?.email || user?.email || "";
  const avatarInitials = getInitials(displayName);

  // A sub-page opened from another section (see BackState in config/page-titles.ts) keeps that
  // section highlighted.
  const currentPath = useHistoryState<BackState>()?.backTo ?? location;
  const isActive = ({ href, matchPrefix }: NavItem) =>
    currentPath === href || (!!matchPrefix && currentPath.startsWith(`${href}/`));

  // The Discussions category appears with the first discussion of the active SaaS (not while they
  // load either, so it never shows empty). Same query as its list, read from the cache.
  const hasDiscussions = (useCoachConversations().data?.length ?? 0) > 0;
  const groups = NAV_GROUPS.filter(
    (group) =>
      (!group.adminOnly || isAdmin) && !("Content" in group && group.Content === SidebarDiscussions && !hasDiscussions),
  );

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* The active SaaS, to switch to another one or create one (in place of the MakeSaaS logo). */}
      <SidebarHeader className="flex min-h-16 items-center justify-center overflow-visible px-2 py-2 transition-[width,height] ease-linear group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:py-0">
        <SaasSwitcher isCollapsed={isCollapsed} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="py-1">
          <TalkToGusLink active={currentPath === COACH_PATH} isCollapsed={isCollapsed} />
        </SidebarGroup>

        {/* One category per group, stacked from the top: a small label (hidden when the sidebar is
            collapsed to icons), then its links. */}
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/60">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {"Content" in group ? (
                <group.Content isCollapsed={isCollapsed} currentPath={currentPath} />
              ) : (
                <SidebarMenu className="gap-1">
                  {group.items.map((item) =>
                    item.children ? (
                      <NavFolder
                        key={item.href}
                        item={{ ...item, children: item.children }}
                        active={isActive(item)}
                        isCollapsed={isCollapsed}
                        currentPath={currentPath}
                      />
                    ) : (
                      <NavLink key={item.href} item={item} active={isActive(item)} isCollapsed={isCollapsed} />
                    ),
                  )}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="items-center overflow-hidden border-t border-white/[0.06] p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              <button type="button" className={userMenuCollapsedClass} aria-label="Menu utilisateur">
                <Avatar className="size-8 rounded-full">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile?.email || "Avatar utilisateur"} referrerPolicy="no-referrer" /> : null}
                  <AvatarFallback className={userAvatarFallbackClass}>{avatarInitials}</AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <SidebarMenuButton size="lg" className={userMenuClass}>
                <Avatar className="size-8 shrink-0 rounded-full">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile?.email || "Avatar utilisateur"} referrerPolicy="no-referrer" /> : null}
                  <AvatarFallback className={userAvatarFallbackClass}>{avatarInitials}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left leading-tight animate-in fade-in duration-300">
                  <span className="truncate">{displayName}</span>
                  <span className="truncate text-xs font-normal text-sidebar-foreground/45">{displayEmail}</span>
                </div>
                <ChevronsUpDown className="!size-4 shrink-0 opacity-60" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            // Expanded: exactly the trigger's width, centered on it, so it never overflows the sidebar.
            // Collapsed: the trigger is a 32px avatar, so fall back to a fixed width next to it.
            className={isCollapsed ? "w-60" : "w-[--radix-dropdown-menu-trigger-width] min-w-0"}
            side={isCollapsed ? "right" : "top"}
            align={isCollapsed ? "end" : "center"}
            // Closing the menu would give the focus back to its trigger, which then keeps a focus
            // style as if reached with the keyboard.
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <SettingsIcon />
                Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => signOut()}>
              <LogOut />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
