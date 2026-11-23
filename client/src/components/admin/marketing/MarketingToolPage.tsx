import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/StateCard";
import { getMarketingTool } from "@/config/marketing-tools";

/**
 * /admin/marketing/:toolId: the tool full size in the page (it has its own fullscreen button). The
 * tool brings the admin back to the list by posting { type: "marketing-tool:home" } (on Escape).
 */
export function MarketingToolPage({ toolId }: { toolId: string }) {
  const tool = getMarketingTool(toolId);
  const [, setLocation] = useLocation();
  const frameRef = useRef<HTMLIFrameElement>(null);

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
    <iframe
      ref={frameRef}
      title={tool.title}
      src={tool.src}
      allow="fullscreen; autoplay"
      className="block h-[calc(100svh-10rem)] min-h-[520px] w-full rounded-2xl border border-border bg-black"
    />
  );
}
