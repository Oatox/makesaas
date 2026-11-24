import { useEffect, useState } from "react";

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

/**
 * Covers a carousel's card while the server generates it, plainly: the time spent and a bar easing
 * towards the usual minute.
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
      className="absolute inset-0 flex flex-col p-4"
    >
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
