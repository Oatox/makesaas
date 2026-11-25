import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Height of a node's row, in px: the path's vertical step. */
const ROW = 156;
/**
 * Below this width (phones), the path winds along the left of the panel and every label sits on its
 * right; above it, the path winds across the middle with each label on the side with room.
 */
const COMPACT_WIDTH = 480;
/** Diameter of a node, in px: the one in progress and the goal stand out, the others are a size down. */
const NODE = { regular: 72, large: 88, compactRegular: 58, compactLarge: 70 };
/** Room between a node's edge and its label, in px. */
const GAP = { regular: 22, compact: 14 };
/** Width of the groove the path runs in, and of its orange fill once travelled, in px. */
const GROOVE = 14;
const FILL = 9;

/** A node of the path: an objective of the Roadmap page (pages/Roadmap.tsx). */
export type PathNode = {
  key: string;
  /** Small caps above the title ("Objectif 2", "Objectif final"). */
  kicker: string;
  title: string;
  /** Under the title: when it was reached, its figure, or "À venir". */
  status: string;
  done: boolean;
  /** Share reached, for the ring of the one in progress (0 to 1). */
  progress: number;
  icon: LucideIcon;
  /** Drawn as the summit. */
  isGoal?: boolean;
};

/** The id of the drawer of the open milestone (pages/Roadmap.tsx), which the open node controls. */
export const MILESTONE_PANEL_ID = "roadmap-milestone-panel";

/** Where a node sits across the path, in % of its width: a smooth wave from side to side (on phones, within the left third). */
const xOf = (index: number, compact: boolean) => {
  const wave = Math.sin((index * Math.PI) / 2.5);
  return compact ? 25 + 10 * wave : 50 + 24 * wave;
};

/**
 * The faces of the nodes, the buttons' 3D recipe (.btn-3d in index.css) with their colors: reached ones
 * orange, the one in progress a raised grey, those to come darker and flatter (their top set too: the
 * derived one would make them as bright as the one in progress).
 */
const FACE_UPCOMING = {
  "--btn-color": "hsl(160 6% 13%)",
  "--btn-top": "hsl(160 5% 17%)",
  "--btn-edge": "hsl(160 9% 7%)",
  "--btn-inner": "hsl(160 6% 11%)",
  "--btn-highlight": "hsl(0 0% 100% / 0.09)",
  "--btn-glow": "rgb(0 0 0 / 0.5)",
} as CSSProperties;

/** A ring around the node in progress, filled with the share of its steps passed. */
function ProgressRing({ size, value, animate }: { size: number; value: number; animate: boolean }) {
  const box = size + 18;
  const radius = box / 2 - 3;
  return (
    <svg aria-hidden width={box} height={box} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90">
      <circle cx={box / 2} cy={box / 2} r={radius} fill="none" stroke="hsl(160 12% 5%)" strokeWidth={5} />
      {value > 0 && (
        <motion.circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={5}
          strokeLinecap="round"
          initial={animate ? { pathLength: 0 } : false}
          animate={{ pathLength: Math.min(1, value) }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 4px hsl(var(--primary) / 0.6))" }}
        />
      )}
    </svg>
  );
}

/**
 * The roadmap drawn as a winding path sunk into the panel, one raised node per objective: the way
 * travelled filled in orange up to the objective in progress, which stands out ("Tu es ici", a ring of
 * its figure, a halo), reached ones in orange, those to come dimmed, the goal at the end. Clicking a node
 * (or its label) opens what the objective means and where the member stands (pages/Roadmap.tsx).
 */
export function RoadmapPath({
  nodes,
  current,
  open,
  onOpen,
}: {
  nodes: PathNode[];
  /** The node in progress; null once every one is reached. */
  current: number | null;
  /** The open milestone's index; null: none. */
  open: number | null;
  onOpen: (index: number) => void;
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

  const compact = width > 0 && width < COMPACT_WIDTH;
  const height = nodes.length * ROW;
  const point = (index: number) => ({ x: (width * xOf(index, compact)) / 100, y: index * ROW + ROW / 2 });
  // One S-curve per pair of nodes, leaving each one straight down and reaching the next one from above.
  const bend = ROW * 0.55;
  const segments = nodes.slice(0, -1).map((_, index) => {
    const a = point(index);
    const b = point(index + 1);
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + bend} ${b.x} ${b.y - bend} ${b.x} ${b.y}`;
  });
  // Orange up to the node in progress (or the whole way once at the goal).
  const reached = current ?? nodes.length - 1;

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[720px]" style={{ height }}>
      {width > 0 && (
        <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 overflow-visible">
          {/* The groove: a faint light lip under it, then its dark hollow, dotted with the way to go. */}
          <g transform="translate(0 1.5)">
            {segments.map((d, index) => (
              <path key={`lip-${index}`} d={d} fill="none" stroke="hsl(0 0% 100% / 0.05)" strokeWidth={GROOVE} strokeLinecap="round" />
            ))}
          </g>
          {segments.map((d, index) => (
            <path key={`groove-${index}`} d={d} fill="none" stroke="hsl(160 12% 5.5%)" strokeWidth={GROOVE} strokeLinecap="round" />
          ))}
          {segments.map((d, index) => (
            <path key={`dots-${index}`} d={d} fill="none" stroke="hsl(0 0% 100% / 0.13)" strokeWidth={3} strokeDasharray="0 11" strokeLinecap="round" />
          ))}
          {/* The way travelled, filled in orange and glowing. */}
          <g style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.45))" }}>
            {segments.slice(0, reached).map((d, index) => (
              <motion.path
                key={`done-${index}`}
                d={d}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={FILL}
                strokeLinecap="round"
                initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.15 + index * 0.12, ease: "easeInOut" }}
              />
            ))}
          </g>
        </svg>
      )}

      <ol className="relative h-full">
        {nodes.map((node, index) => {
          const isCurrent = index === current;
          const complete = node.done;
          const upcoming = !complete && !isCurrent;
          const x = xOf(index, compact);
          const large = isCurrent || !!node.isGoal;
          const size = compact ? (large ? NODE.compactLarge : NODE.compactRegular) : large ? NODE.large : NODE.regular;
          const offset = size / 2 + (compact ? GAP.compact : GAP.regular);
          const labelRight = compact || x <= 50;
          // Reached ones show a check, but the goal keeps its trophy.
          const Icon = complete && !node.isGoal ? Check : node.icon;
          const isOpen = index === open;
          return (
            <motion.li
              key={node.key}
              // Hovering the node or its label (not the empty row) lights both up.
              className="group pointer-events-none absolute inset-x-0"
              style={{ top: index * ROW, height: ROW }}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              {/* The node. */}
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%` }}>
                {isCurrent && (
                  <>
                    <span aria-hidden className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-2xl" />
                    {!reduceMotion && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-primary/25"
                        animate={{ scale: [1, 1.55], opacity: [0.55, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                  </>
                )}
                {node.isGoal && !complete && !isCurrent && (
                  // The goal, still to come: a dashed orange ring, the finish line.
                  <span aria-hidden className="absolute -inset-[9px] rounded-full border-2 border-dashed border-primary/45" />
                )}
                {isCurrent && <ProgressRing size={size} value={node.progress} animate={!reduceMotion} />}
                <button
                  type="button"
                  onClick={() => onOpen(index)}
                  aria-label={`${node.title} : ${node.status}`}
                  aria-haspopup="dialog"
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? MILESTONE_PANEL_ID : undefined}
                  className={cn(
                    "btn-3d pointer-events-auto relative flex items-center justify-center rounded-full group-hover:brightness-110",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background",
                    complete
                      ? "btn-3d-primary text-primary-foreground"
                      : cn("btn-3d-secondary", isCurrent || node.isGoal ? "text-primary" : "text-muted-foreground/70"),
                  )}
                  style={{ width: size, height: size, ...(upcoming && !node.isGoal ? FACE_UPCOMING : {}) }}
                >
                  <Icon aria-hidden size={Math.round(size * (large ? 0.4 : 0.38))} strokeWidth={complete ? 3 : 2} />
                </button>
              </div>

              {/* Its label, on the side with room. */}
              <button
                type="button"
                onClick={() => onOpen(index)}
                tabIndex={-1}
                className={cn("pointer-events-auto absolute top-1/2 flex -translate-y-1/2 flex-col", labelRight ? "items-start text-left" : "items-end text-right")}
                style={
                  labelRight
                    ? { left: `calc(${x}% + ${offset}px)`, maxWidth: `calc(${100 - x}% - ${offset + 8}px)` }
                    : { right: `calc(${100 - x}% + ${offset}px)`, maxWidth: `calc(${x}% - ${offset + 8}px)` }
                }
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-[0.08em]",
                      node.isGoal ? "text-primary" : upcoming ? "text-muted-foreground/60" : "text-muted-foreground",
                    )}
                  >
                    {node.kicker}
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.7)]">
                      Tu es ici
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "mt-1 block font-display font-light leading-tight transition-colors",
                    isCurrent ? "text-lg sm:text-2xl" : "text-base sm:text-xl",
                    complete || isCurrent
                      ? "text-foreground"
                      : node.isGoal
                        ? "text-foreground/80 group-hover:text-foreground"
                        : "text-foreground/55 group-hover:text-foreground/85",
                  )}
                >
                  {node.title}
                </span>
                {isCurrent ? (
                  <span className="mt-2.5 flex items-center gap-2.5">
                    <span className="block h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-secondary sm:w-24">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-700"
                        style={{ width: `${Math.min(1, node.progress) * 100}%` }}
                      />
                    </span>
                    <span className="whitespace-nowrap text-xs tabular-nums text-foreground/80">{node.status}</span>
                  </span>
                ) : (
                  <span
                    className={cn(
                      "mt-1.5 flex items-center gap-1 text-xs",
                      complete ? "text-primary" : "text-muted-foreground/60",
                    )}
                  >
                    {complete && <Check aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
                    {node.status}
                  </span>
                )}
              </button>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
