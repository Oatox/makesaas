import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/StateCard";
import { getMarketingTool } from "@/config/marketing-tools";

/**
 * /admin/marketing/:toolId: the tool full size in the page (it has its own fullscreen button). The
 * tool brings the admin back to the list by posting { type: "marketing-tool:home" } (on Escape).
 * "Recommencer" reloads it, so every answer picked in it is gone, outside the filmed area.
 */
export function MarketingToolPage({ toolId }: { toolId: string }) {
  const tool = getMarketingTool(toolId);
  const [, setLocation] = useLocation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Bumped by "Recommencer": a new iframe, the tool from its start.
  const [run, setRun] = useState(0);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "marketing-tool:home") setLocation("/admin/marketing");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setLocation]);

  if (!tool) {
    return <EmptyState icon={SearchX} title="Outil introuvable" description="Cet outil n'existe pas ou a été retiré." />;
  }

  return (
    <div className="space-y-3">
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
        className="block h-[calc(100svh-13rem)] min-h-[520px] w-full rounded-2xl border border-border bg-black"
      />
    </div>
  );
}
