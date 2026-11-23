import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Clapperboard,
  CreditCard,
  Flag,
  Hammer,
  Lightbulb,
  Palette,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { stageProgress, type MissionDone, type RoadmapStage } from "@shared/roadmap";
import { cn } from "@/lib/utils";

/** Height of a stage's row, in px: the path's vertical step. */
const ROW = 156;
/** Diameter of a stage's node, in px. */
const NODE = 76;
/** The id of the drawer of the open stage's missions (pages/Roadmap.tsx), which the open node controls. */
export const STAGE_PANEL_ID = "roadmap-stage-panel";

/** Each stage's icon; the MRR stages share one, the goal has its flag. */
const ICONS: Record<string, LucideIcon> = {
  idea: Lightbulb,
  build: Hammer,
  brand: Palette,
  payment: CreditCard,
  video: Clapperboard,
  customer: UserRound,
};
const iconOf = (stage: RoadmapStage) => (stage.isGoal ? Flag : (ICONS[stage.key] ?? TrendingUp));

/** Where a stage's node sits across the path, in % of its width: a smooth wave from side to side. */
const xOf = (index: number) => 50 + 24 * Math.sin((index * Math.PI) / 2.5);

/** A ring around the node, filled with the share of its missions done. */
function ProgressRing({ value, active }: { value: number; active: boolean }) {
  const size = NODE + 14;
  const radius = size / 2 - 3;
  const length = 2 * Math.PI * radius;
  return (
    <svg aria-hidden width={size} height={size} className="pointer-events-none absolute -left-[7px] -top-[7px] -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth={4} />
      {value > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={active ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.6)"}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${length * value} ${length}`}
        />
      )}
    </svg>
  );
}

/**
 * The roadmap drawn as a winding path, one big node per stage: done ones in orange, the member's
 * current one marked "Tu es ici", the goal flagged at the end. Clicking a node (or its label)
 * opens its missions in the drawer (pages/Roadmap.tsx).
 */
export function RoadmapPath({
  stages,
  done,
  current,
  open,
  onToggle,
}: {
  stages: RoadmapStage[];
  done: Record<string, MissionDone>;
  /** The stage the member is on; null once every stage is done. */
  current: number | null;
  /** The stage whose missions are open; null: none. */
  open: number | null;
  onToggle: (index: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  // The path is drawn in real pixels: the container's width, measured (and followed on resize).
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const height = stages.length * ROW;
  const point = (index: number) => ({ x: (width * xOf(index)) / 100, y: index * ROW + ROW / 2 });
  // One S-curve per pair of stages, leaving each node straight down and reaching the next one from above.
  const bend = ROW * 0.55;
  const segments = stages.slice(0, -1).map((_, index) => {
    const a = point(index);
    const b = point(index + 1);
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + bend} ${b.x} ${b.y - bend} ${b.x} ${b.y}`;
  });
  // Orange up to the current stage (or the whole way once at the goal).
  const reached = current ?? stages.length - 1;

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[720px]" style={{ height }}>
      {width > 0 && (
        <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0">
          {segments.map((d, index) => (
            <path key={`track-${index}`} d={d} fill="none" stroke="hsl(160 6% 15%)" strokeWidth={14} strokeLinecap="round" />
          ))}
          {segments.map((d, index) => (
            <path key={`dash-${index}`} d={d} fill="none" stroke="hsl(0 0% 100% / 0.14)" strokeWidth={2} strokeDasharray="2 10" strokeLinecap="round" />
          ))}
          {segments.slice(0, reached).map((d, index) => (
            <motion.path
              key={`done-${index}`}
              d={d}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={14}
              strokeLinecap="round"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.15 + index * 0.25, ease: "easeInOut" }}
            />
          ))}
        </svg>
      )}

      <ol className="relative h-full">
        {stages.map((stage, index) => {
          const progress = stageProgress(stage, done);
          const isCurrent = index === current;
          const isOpen = index === open;
          const complete = progress.complete;
          const x = xOf(index);
          const labelRight = x <= 50;
          const Icon = iconOf(stage);
          return (
            <motion.li
              key={stage.key}
              className="absolute inset-x-0"
              style={{ top: index * ROW, height: ROW }}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              {/* The node. */}
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%` }}>
                {isCurrent && (
                  <>
                    {!reduceMotion && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-primary/30"
                        animate={{ scale: [1, 1.45], opacity: [0.5, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                    <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-[0_4px_12px_-4px_hsl(var(--primary)/0.6)]">
                      Tu es ici
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onToggle(index)}
                  aria-label={`${stage.title} : ${progress.done} mission${progress.done > 1 ? "s" : ""} sur ${progress.total}`}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? STAGE_PANEL_ID : undefined}
                  className={cn(
                    "relative flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 active:translate-y-[3px] active:scale-100",
                    isOpen && "scale-105",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background",
                    complete
                      ? "bg-gradient-to-b from-[hsl(24_100%_60%)] to-[hsl(18_95%_48%)] text-primary-foreground shadow-[0_6px_0_0_hsl(16_90%_32%),0_12px_24px_-8px_hsl(var(--primary)/0.5)]"
                      : isCurrent
                        ? "bg-gradient-to-b from-[hsl(160_7%_20%)] to-[hsl(160_8%_12%)] text-primary shadow-[0_6px_0_0_hsl(160_9%_7%),0_0_0_3px_hsl(var(--primary))]"
                        : stage.isGoal
                          ? "bg-gradient-to-b from-[hsl(160_7%_17%)] to-[hsl(160_8%_11%)] text-primary shadow-[0_6px_0_0_hsl(160_9%_6%),0_0_0_2px_hsl(var(--primary)/0.45)]"
                          : "bg-gradient-to-b from-[hsl(160_7%_17%)] to-[hsl(160_8%_11%)] text-muted-foreground shadow-[0_6px_0_0_hsl(160_9%_6%)]",
                  )}
                  style={{ width: NODE, height: NODE }}
                >
                  {!complete && <ProgressRing value={progress.done / progress.total} active={isCurrent} />}
                  {complete ? <Check className="h-9 w-9" strokeWidth={3} /> : <Icon className="h-8 w-8" />}
                </button>
              </div>

              {/* Its label, on the side with room. */}
              <button
                type="button"
                onClick={() => onToggle(index)}
                tabIndex={-1}
                className={cn("absolute top-1/2 -translate-y-1/2 text-left", !labelRight && "text-right")}
                style={
                  labelRight
                    ? { left: `calc(${x}% + ${NODE / 2 + 18}px)`, maxWidth: `calc(${100 - x}% - ${NODE / 2 + 26}px)` }
                    : { right: `calc(${100 - x}% + ${NODE / 2 + 18}px)`, maxWidth: `calc(${x}% - ${NODE / 2 + 26}px)` }
                }
              >
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stage.isGoal ? "Ton objectif" : `Étape ${index + 1}`}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block font-display text-base font-light leading-tight sm:text-xl",
                    complete || isCurrent ? "text-foreground" : "text-foreground/70",
                  )}
                >
                  {/* The kicker already says it is the goal. */}
                  {stage.isGoal ? stage.title.replace(/^Ton objectif : /, "") : stage.title}
                </span>
                <span className={cn("mt-1 block text-xs", complete ? "text-primary" : "text-muted-foreground")}>
                  {complete ? "Terminée" : `${progress.done}/${progress.total} mission${progress.total > 1 ? "s" : ""}`}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>

    </div>
  );
}
