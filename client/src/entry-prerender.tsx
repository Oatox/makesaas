// Build-time entry (vite SSR build, see script/build.ts): renders the public pages to HTML
// so crawlers and link previews get real content without running JavaScript.
import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "@/pages/Landing";
import MentionsLegales from "@/pages/MentionsLegales";
import CGU from "@/pages/CGU";
import CGV from "@/pages/CGV";
import Confidentialite from "@/pages/Confidentialite";

export { PUBLIC_PAGES, renderHead, renderAppShellHead, renderSitemap } from "@/config/seo";

const PAGE_COMPONENTS: Record<string, ComponentType> = {
  "/": Landing,
  "/mentions-legales": MentionsLegales,
  "/cgu": CGU,
  "/cgv": CGV,
  "/confidentialite": Confidentialite,
};

export function renderPage(path: string): string {
  const Page = PAGE_COMPONENTS[path];
  if (!Page) throw new Error(`No prerender component for ${path}: add it to PAGE_COMPONENTS`);

  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <TooltipProvider>
          <Router ssrPath={path}>
            <Page />
          </Router>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
