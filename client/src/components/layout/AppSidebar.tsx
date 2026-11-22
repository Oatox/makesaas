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
  LayoutDashboard,
  ShieldCheck,
  Users,
  LogOut,
  ChevronRight,
  Settings as SettingsIcon,
  Workflow,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/Logo";
import { getInitials } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon; matchPrefix?: boolean };
type NavGroup = { label: string; items: NavItem[]; adminOnly?: boolean };

// Single source for the sidebar navigation.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Application",
    items: [
      { href: "/app", label: "Tableau de bord", icon: LayoutDashboard, matchPrefix: true },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { href: "/admin", label: "Aperçu Admin", icon: ShieldCheck },
      { href: "/admin/users", label: "Utilisateurs", icon: Users, matchPrefix: true },
      { href: "/admin/pipeline", label: "Pipeline", icon: Workflow },
    ],
  },
];

// Bigger items, rounded like the buttons; the active one gets an orange tint, an orange
// icon and a small orange bar on the left. Collapsed (icon) mode shrinks to a centered square.
const navItemClass =
  "relative h-14 gap-3.5 rounded-[12px] px-4 text-base font-medium md:h-12 text-sidebar-foreground/70 transition-colors " +
  "hover:bg-sidebar-accent hover:text-sidebar-foreground [&>svg]:size-[22px] " +
  "data-[active=true]:bg-primary/10 data-[active=true]:text-sidebar-foreground data-[active=true]:[&>svg]:text-primary " +
  "before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full " +
  "before:bg-primary before:opacity-0 data-[active=true]:before:opacity-100 group-data-[collapsible=icon]:before:hidden " +
  // Collapsed (icon-only) sidebar: compact centered square, smaller icon
  "group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center " +
  "group-data-[collapsible=icon]:rounded-[10px] group-data-[collapsible=icon]:[&>svg]:size-[18px]";

// User dropdown rows mirror the nav items (height, radius, text and 22px icons).
const menuItemClass =
  "h-14 cursor-pointer gap-3.5 rounded-[12px] px-4 text-base font-medium md:h-12 sm:rounded-[12px] sm:px-4 sm:py-0 " +
  "text-sidebar-foreground/80 [&_svg]:size-[22px] data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-sidebar-foreground " +
  "focus:bg-sidebar-accent focus:text-sidebar-foreground";

const groupLabelClass =
  "mb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden";

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
        <Link href="/app" className="flex h-full w-full items-center justify-center gap-2 px-2 pt-1 text-sidebar-foreground">
          {isCollapsed ? (
            <Logo variant="mark" className="h-7 w-7" />
          ) : (
            <Logo className="h-7 animate-in fade-in duration-300" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className={groupLabelClass}>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2 md:gap-1.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label} className={navItemClass}>
                      <Link href={item.href}>
                        <item.icon className="shrink-0" />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
