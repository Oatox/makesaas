import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/StateCard";
import { getMarketingTool } from "@/config/marketing-tools";
import { cn } from "@/lib/utils";

/**
 * /admin/marketing/:toolId: the tool full size in the page (it has its own fullscreen button). The
 * tool brings the admin back to the list by posting { type: "marketing-tool:home" } (on Escape).
 * "Recommencer" reloads it, so every answer picked in it is gone, outside the filmed area.
 *
 * A tool's fullscreen button may post { type: "marketing-tool:fill" }: the tool then fills the whole
 * page, over the app's header and menu, while the browser's own bars stay in view (filmed, the fake
 * onboardings look like the real one in a browser). On a computer, the onboardings post
 * { type: "marketing-tool:unfill" } to give the page back (F, Escape or the button again, and as each
 * page of theirs starts: turning one with T reloads it); turned like a phone, they use the browser's
 * own fullscreen, as the roulette does. On a phone or a tablet the tool fills the page until it is
 * reloaded (to film, nothing on screen brings the admin back).
 */
export function MarketingToolPage({ toolId }: { toolId: string }) {
  const tool = getMarketingTool(toolId);
  const [, setLocation] = useLocation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Bumped by "Recommencer": a new iframe, the tool from its start.
  const [run, setRun] = useState(0);
  const [filling, setFilling] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "marketing-tool:home") setLocation("/admin/marketing");
      if (event.data?.type === "marketing-tool:fill") setFilling(true);
      if (event.data?.type === "marketing-tool:unfill") setFilling(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setLocation]);

  // The page under the tool must not scroll while it fills the screen.
  useEffect(() => {
    if (!filling) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [filling]);

  if (!tool) {
    return <EmptyState icon={SearchX} title="Outil introuvable" description="Cet outil n'existe pas ou a été retiré." />;
  }

  return (
    // A gap, not space-y: a margin would shift the tool down while it fills the page.
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground">{tool.description}</p>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setRun((n) => n + 1)}>
          <RotateCcw />
          Recommencer
        </Button>
      </div>
      <iframe
        key={run}
        ref={frameRef}
        title={tool.title}
        src={tool.src}
        allow="fullscreen; autoplay"
        className={cn(
          "block h-[calc(100svh-13rem)] min-h-[520px] w-full rounded-2xl border border-border bg-black",
          // The whole visible page (dvh: what the browser's bars leave), over the header and the menu.
          filling && "fixed inset-0 z-[100] h-[100dvh] min-h-0 rounded-none border-0",
        )}
      />
    </div>
  );
}
