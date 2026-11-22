import { Link, useLocation } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import { ArrowLeft } from "lucide-react";
import { getBackHref, getPageTitle, type BackState } from "@/config/page-titles";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { HeaderActionsSlot } from "./HeaderActions";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const pageTitle = getPageTitle(location);
  const backHref = getBackHref(location, useHistoryState<BackState>());
  const isAdminPage = location === "/admin" || location.startsWith("/admin/");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden border-0 bg-card shadow-md md:border">
        <header className="flex h-16 items-center gap-3 bg-card px-4 backdrop-blur transition-[width,height] ease-linear md:px-6 group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <SidebarTrigger />
          {backHref && (
            <Button variant="ghost" size="icon" asChild className="h-12 w-12 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:h-8 md:w-8">
              <Link href={backHref} aria-label="Retour">
                <ArrowLeft className="!size-7 md:!size-5" />
              </Link>
            </Button>
          )}
          {pageTitle && (
            <>
              <div aria-hidden className="h-5 w-px bg-border" />
              <h1 className="truncate font-display text-lg font-semibold tracking-tight">{pageTitle}</h1>
            </>
          )}
          <HeaderActionsSlot />
        </header>
        {/* Page gutter: compact on mobile; from lg up, 10% of the width on each side for user
            pages, none for the admin pages (wide tables and charts). Pages must not add their
            own max-width/centering, nor top/bottom spacing. */}
        <div className={`flex-1 overflow-y-auto px-4 md:px-5 ${isAdminPage ? "" : "lg:px-[10%]"}`}>
          <div className="w-full bg-card p-2 pt-4 pb-10 md:p-3 md:pt-6 md:pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
