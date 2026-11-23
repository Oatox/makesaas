import { useEffect } from "react";
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  House,
  ShieldCheck,
  Users,
  LogOut,
  ChevronRight,
  Settings as SettingsIcon,
  Workflow,
  Megaphone,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

type NavItem = { href: string; label: string; icon: LucideIcon; matchPrefix?: boolean };
type NavGroup = { label: string; items: NavItem[]; adminOnly?: boolean };

// Single source for the sidebar navigation.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Application",
    items: [
      { href: "/app", label: "Accueil", icon: House, matchPrefix: true },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { href: "/admin", label: "Aperçu Admin", icon: ShieldCheck },
      { href: "/admin/users", label: "Utilisateurs", icon: Users, matchPrefix: true },
      { href: "/admin/pipeline", label: "Pipeline", icon: Workflow },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone, matchPrefix: true },
    ],
  },
];

// Links listed flat under their category label: muted at rest, a light wash on hover. The active one
// gets a soft fill with a thin border and a top highlight, white text and an orange icon. Collapsed to
// icons, each link is a 40px square with the same active style. Tailwind 3 applies stacked variants
// right to left:
// [&>svg]:hover: styles the icon when the link is hovered.
const navLinkClass =
  "h-11 gap-3 rounded-[10px] border border-transparent px-3 text-[15px] font-medium text-sidebar-foreground/65 transition-colors duration-150 " +
  "[&>svg]:size-5 [&>svg]:text-sidebar-foreground/45 [&>svg]:transition-colors " +
  "hover:bg-white/[0.045] hover:text-sidebar-foreground [&>svg]:hover:text-sidebar-foreground/80 " +
  "data-[active=true]:border-white/[0.09] data-[active=true]:bg-white/[0.07] data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground " +
  "data-[active=true]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] [&>svg]:data-[active=true]:text-primary hover:data-[active=true]:bg-white/[0.07] " +
  "group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center";

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

// User dropdown rows mirror the nav items (height, radius, text and 22px icons).
const menuItemClass =
  "h-14 cursor-pointer gap-3.5 rounded-[12px] px-4 text-base font-medium md:h-12 sm:rounded-[12px] sm:px-4 sm:py-0 " +
  "text-sidebar-foreground/80 [&_svg]:size-[22px] data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-sidebar-foreground " +
  "focus:bg-sidebar-accent focus:text-sidebar-foreground";

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

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="h-16 flex items-center justify-center overflow-hidden transition-[width,height] ease-linear group-data-[collapsible=icon]:h-12">
        <Link href="/app" aria-label="MakeSaaS" className="flex h-full w-full items-center justify-center px-2 pt-1 text-sidebar-foreground">
          {isCollapsed ? (
            <Logo variant="mark" className="h-7 w-7" />
          ) : (
            <Logo className="h-5 animate-in fade-in duration-300" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* One category per group, stacked from the top: a small label (hidden when the sidebar is
            collapsed to icons), then its links. */}
        {NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin).map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/60">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item)} isCollapsed={isCollapsed} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="items-center border-t border-border/20 p-2.5 overflow-hidden group-data-[collapsible=icon]:p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full p-0 outline-hidden ring-sidebar-ring transition-colors hover:bg-sidebar-accent focus-visible:ring-2 data-[state=open]:bg-sidebar-accent"
                aria-label="Menu utilisateur"
              >
                <Avatar className="h-8 w-8 rounded-full">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile?.email || "Avatar utilisateur"} referrerPolicy="no-referrer" /> : null}
                  <AvatarFallback className="rounded-full bg-primary/10 text-primary text-xs">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <SidebarMenuButton
                size="lg"
                className="group/user-menu !h-16 rounded-[12px] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center justify-start gap-3.5 px-3 cursor-pointer"
              >
                <Avatar className="h-11 w-11 shrink-0 rounded-full">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile?.email || "Avatar utilisateur"} referrerPolicy="no-referrer" /> : null}
                  <AvatarFallback className="rounded-full bg-primary/10 text-primary">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 gap-0.5 text-left leading-tight animate-in fade-in duration-300">
                  <span className="truncate text-base font-semibold">{displayName}</span>
                  <span className="truncate text-sm text-sidebar-foreground/70">{displayEmail}</span>
                </div>
                <ChevronRight className="ml-auto !size-5 shrink-0 transition-transform duration-200 group-data-[state=open]/user-menu:-rotate-90" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            // Expanded: exactly the trigger's width, centered on it, so it never overflows the sidebar.
            // Collapsed: the trigger is a 32px avatar, so fall back to a fixed width next to it.
            className={`rounded-[14px] border-sidebar-border bg-sidebar p-1.5 text-sidebar-foreground ${
              isCollapsed ? "w-60" : "w-[--radix-dropdown-menu-trigger-width] min-w-0"
            }`}
            side={isCollapsed ? "right" : "top"}
            align={isCollapsed ? "end" : "center"}
            sideOffset={4}
          >
            <DropdownMenuItem
              asChild
              className={menuItemClass}
            >
              <Link href="/settings" className="flex w-full items-center gap-3.5">
                <SettingsIcon className="shrink-0" />
                <span>Paramètres</span>
              </Link>
            </DropdownMenuItem>
            <div className="my-1 h-px bg-sidebar-border/70" />
            <DropdownMenuItem
              className={`${menuItemClass} text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive focus:bg-destructive/10 focus:text-destructive`}
              onClick={() => signOut()}
            >
              <LogOut className="shrink-0" />
              <span>Déconnexion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
