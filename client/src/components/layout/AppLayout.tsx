import { Link, useLocation } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import { ArrowLeft } from "lucide-react";
import { getBackHref, getPageTitle, type BackState } from "@/config/page-titles";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { HeaderActionsSlot } from "./HeaderActions";
import { TalkToGusButton } from "@/components/coach/TalkToGusButton";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const pageTitle = getPageTitle(location);
  const backHref = getBackHref(location, useHistoryState<BackState>());
  const isAdminPage = location === "/admin" || location.startsWith("/admin/");
  // Pages that fill the window and scroll their own areas (the discussions: the message field
  // stays at the bottom while the messages scroll).
  const isFullHeightPage = location === "/discussions" || location.startsWith("/discussions/");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset
        className={`min-w-0 overflow-hidden border-0 bg-card shadow-md md:border ${
          // The inset sidebar leaves a 0.5rem margin around the page from md up.
          isFullHeightPage ? "h-svh md:h-[calc(100svh-1rem)]" : ""
        }`}
      >
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
              <h1 className="truncate font-display text-lg font-normal tracking-tight">{pageTitle}</h1>
            </>
          )}
          <HeaderActionsSlot />
          <TalkToGusButton />
        </header>
        {/* Page gutter: compact on mobile; from lg up, 10% of the width on each side for user
            pages, none for the admin pages (wide tables and charts). Pages must not add their
            own max-width/centering, nor top/bottom spacing. Full-height pages get the remaining
            height as a flex column instead of a scrolling area. */}
        {isFullHeightPage ? (
          <div className="flex min-h-0 flex-1 flex-col px-4 md:px-5 lg:px-[4%]">
            {/* No entry animation: the discussion shows in place at once. */}
            <div className="flex min-h-0 w-full flex-1 flex-col bg-card p-1 pb-3 md:p-2 md:pb-4">
              {children}
            </div>
          </div>
        ) : (
          <div className={`flex-1 overflow-y-auto px-4 md:px-5 ${isAdminPage ? "" : "lg:px-[10%]"}`}>
            <div className="w-full bg-card p-2 pt-4 pb-10 md:p-3 md:pt-6 md:pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
