import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** The usual length of a generation: the bar eases towards it and slows down past it, never reaching the end. */
const TYPICAL_MS = 60_000;

/** Current time, ticking every `intervalMs`. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const formatElapsed = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** A shimmering line of the slide being written. */
function SketchLine({ width, thick = false, delay }: { width: string; thick?: boolean; delay: number }) {
  const style: CSSProperties = {
    width,
    animationDelay: `${delay}ms`,
    backgroundImage: "linear-gradient(90deg, hsl(0 0% 100% / 0.07), hsl(0 0% 100% / 0.18), hsl(0 0% 100% / 0.07))",
    backgroundSize: "200% 100%",
  };
  return (
    <div
      aria-hidden
      style={style}
      className={cn("rounded-full animate-[loader-shimmer_2.2s_linear_infinite] motion-reduce:animate-none", thick ? "h-3" : "h-1.5")}
    />
  );
}

/**
 * Covers a carousel's card while the server generates it: a slide sketching itself (title and text
 * lines shimmering), then the time spent and a bar easing towards the usual minute.
 */
export function GeneratingPreview({ startedAt }: { startedAt: string }) {
  const now = useNow(1000);
  const elapsed = Math.max(0, now - Date.parse(startedAt));
  // Fast at first, then slower and slower: about 80 % at the usual minute, 95 % at most.
  const progress = Math.min(0.95, 1 - Math.exp((-1.6 * elapsed) / TYPICAL_MS));
  const late = elapsed > 2 * TYPICAL_MS;

  return (
    <div
      role="status"
      aria-label="Génération du carrousel en cours"
      className="absolute inset-0 flex flex-col bg-[radial-gradient(120%_70%_at_50%_0%,hsl(var(--primary)/0.14),transparent_60%)] p-4"
    >
      <div className="mt-[22%] space-y-2.5">
        <SketchLine width="78%" thick delay={0} />
        <SketchLine width="54%" thick delay={150} />
        <div className="h-2" />
        <SketchLine width="90%" delay={300} />
        <SketchLine width="84%" delay={420} />
        <SketchLine width="66%" delay={540} />
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium text-foreground">{late ? "Presque prêt…" : "Génération…"}</span>
          <span className="tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</span>
        </div>
        <div className="recessed-3d h-1.5 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
