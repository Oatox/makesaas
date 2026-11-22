import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import type { BackState } from "@/config/page-titles";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { SaasSwitcher } from "./SaasSwitcher";

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

// Raised blocks grouping the links, as in dropposting; the active link gets an orange tint.
const navBlockSurfaceClass =
  "rounded-lg border border-white/[0.09] bg-gradient-to-b from-[#252525] to-[#1e1e1e] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.09),0_4px_14px_-10px_rgba(0,0,0,0.35)]";

const navLinkClass =
  "rounded-md border border-transparent bg-transparent text-sidebar-foreground shadow-none transition-[background,border-color,box-shadow] " +
  "hover:border-transparent hover:bg-white/[0.055] hover:shadow-none " +
  "data-[active=true]:border-primary/35 data-[active=true]:bg-gradient-to-b data-[active=true]:from-primary/[0.22] data-[active=true]:to-primary/[0.08] " +
  "data-[active=true]:font-semibold data-[active=true]:text-sidebar-foreground data-[active=true]:[&_svg]:text-primary " +
  "data-[active=true]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10),0_6px_16px_-10px_hsl(var(--primary)/0.35)] " +
  "hover:data-[active=true]:border-primary/45 hover:data-[active=true]:bg-transparent";

const blockLabelClass = "mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function NavBlock({ label, isCollapsed, children }: { label?: string; isCollapsed: boolean; children: ReactNode }) {
  return (
    <div className={cn(navBlockSurfaceClass, isCollapsed ? "p-1" : "p-1.5")}>
      {label && !isCollapsed && <p className={blockLabelClass}>{label}</p>}
      <SidebarMenu className="gap-1">{children}</SidebarMenu>
    </div>
  );
}

function NavLink({ item, active, isCollapsed }: { item: NavItem; active: boolean; isCollapsed: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={cn(navLinkClass, isCollapsed ? "min-h-9 justify-center px-0" : "min-h-9 px-2 py-1.5")}
      >
        <Link href={item.href} className={cn("flex w-full items-center gap-2", isCollapsed && "justify-center")}>
          <item.icon className="shrink-0" />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
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
      <SidebarHeader className="flex min-h-16 items-center justify-center overflow-visible px-2 py-2 transition-[width,height] ease-linear group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:py-0">
        <SaasSwitcher isCollapsed={isCollapsed} />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin).map((group, index) => (
          // The first group sits at the top, the following ones (administration) at the bottom.
          <SidebarGroup key={group.label} className={index > 0 ? "mt-auto" : undefined}>
            <SidebarGroupContent>
              <NavBlock label={index > 0 ? group.label : undefined} isCollapsed={isCollapsed}>
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item)} isCollapsed={isCollapsed} />
                ))}
              </NavBlock>
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
