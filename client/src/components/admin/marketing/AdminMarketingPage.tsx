import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { MARKETING_TOOLS } from "@/config/marketing-tools";

/** /admin/marketing: the marketing tools to pick from, each card with a live preview of the tool. */
export function AdminMarketingPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choisis un outil pour l'ouvrir en grand.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MARKETING_TOOLS.map((tool) => (
          <Link
            key={tool.id}
            href={`/admin/marketing/${tool.id}`}
            className="group overflow-hidden rounded-2xl border border-border bg-background/40 transition-colors hover:border-foreground/20"
          >
            {/* Live preview: the tool itself, shrunk, not interactive */}
            <div className="relative aspect-video overflow-hidden border-b border-border bg-black">
              <iframe
                title={`Aperçu : ${tool.title}`}
                src={tool.src}
                tabIndex={-1}
                aria-hidden
                loading="lazy"
                className="pointer-events-none absolute left-0 top-0 h-[250%] w-[250%] origin-top-left scale-[0.4] border-0"
              />
            </div>
            <div className="flex items-start gap-3 p-4">
              <tool.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{tool.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{tool.description}</p>
              </div>
              <ArrowRight className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
