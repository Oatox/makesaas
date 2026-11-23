import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { motion, type Variants } from "framer-motion";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { RevealItem, RevealSection, revealItem } from "@/components/landing/SectionReveal";
import { NicheMotion, ProgressMotion, SiteMotion } from "@/components/landing/StepScenes";

// ⚠️ PLACEHOLDER: check that each step says what the product really does.
const FEATURES: { Scene: ComponentType; title: string; detail: string }[] = [
  {
    Scene: NicheMotion,
    title: "Trouve ta niche",
    detail: `${COACH_NAME} part de ce qui te passionne pour te proposer des idées faites pour toi, sur un marché où les clients paient déjà.`,
  },
  {
    Scene: SiteMotion,
    title: "Crée ton site",
    detail: "Ton site prend forme étape par étape, avec les bons outils, même si tu n'as jamais codé.",
  },
  {
    Scene: ProgressMotion,
    title: "Suis ta progression",
    detail: `Une tâche par jour, ta roadmap qui se coche, et ${COACH_NAME} qui te relance jusqu'à tes premiers clients.`,
  },
];

// Measured before paint in the browser; the prerender has no layout (the path appears on load).
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* ------------------------------------------------------------------ */
/* The path around the steps                                           */
/* ------------------------------------------------------------------ */

type Box = { x: number; y: number; w: number; h: number };
// A point of the outline; with `r`, reached by an arc of that radius (sweep 1: turning right).
type Point = { x: number; y: number; r?: number; sweep?: 0 | 1 };

// Corner radius around each step, width of the channels between steps, and radius of the
// (small) inside corners where a channel meets a step.
const RADIUS = 20;
const CHANNEL = 56;
const FILLET = 6;

/**
 * Outline of steps laid side by side: one closed line round all of them, the steps joined by
 * channels (two parallel lines at mid-height). Clockwise: along the tops from the first step
 * (dipping into each channel's top line), down the last step, back along the bottoms.
 */
function rowOutline(boxes: Box[], r: number, channel: number, fillet: number): Point[] {
  const middle = boxes[0].y + boxes[0].h / 2;
  const top = middle - channel / 2;
  const bottom = middle + channel / 2;
  const last = boxes.length - 1;
  const points: Point[] = [{ x: boxes[0].x, y: boxes[0].y + r }];

  boxes.forEach((b, i) => {
    if (i > 0) points.push({ x: b.x - fillet, y: top }, { x: b.x, y: top - fillet, r: fillet, sweep: 0 });
    points.push(
      { x: b.x, y: b.y + r },
      { x: b.x + r, y: b.y, r, sweep: 1 },
      { x: b.x + b.w - r, y: b.y },
      { x: b.x + b.w, y: b.y + r, r, sweep: 1 },
    );
    if (i < last) points.push({ x: b.x + b.w, y: top - fillet }, { x: b.x + b.w + fillet, y: top, r: fillet, sweep: 0 });
  });

  for (let i = last; i >= 0; i--) {
    const b = boxes[i];
    if (i < last) points.push({ x: b.x + b.w + fillet, y: bottom }, { x: b.x + b.w, y: bottom + fillet, r: fillet, sweep: 0 });
    points.push(
      { x: b.x + b.w, y: b.y + b.h - r },
      { x: b.x + b.w - r, y: b.y + b.h, r, sweep: 1 },
      { x: b.x + r, y: b.y + b.h },
      { x: b.x, y: b.y + b.h - r, r, sweep: 1 },
    );
    if (i > 0) points.push({ x: b.x, y: bottom + fillet }, { x: b.x - fillet, y: bottom, r: fillet, sweep: 0 });
  }
  return points;
}

/**
 * The outline as an SVG path. Stacked steps are drawn as a row of their transposed boxes, then
 * transposed back: swapping x and y mirrors the drawing, so every arc turns the other way.
 */
function stepsPath(boxes: Box[], row: boolean) {
  const flip = (b: Box): Box => (row ? b : { x: b.y, y: b.x, w: b.h, h: b.w });
  const laid = boxes.map(flip);
  const gap = Math.min(...laid.slice(1).map((b, i) => b.x - (laid[i].x + laid[i].w)));
  const thinnest = Math.min(...laid.map((b) => b.h));
  const r = Math.min(RADIUS, ...laid.map((b) => Math.min(b.w, b.h) / 2));
  const fillet = Math.max(0, Math.min(FILLET, gap / 2));
  const channel = Math.min(CHANNEL, thinnest - 2 * (r + fillet));
  return toPath(rowOutline(laid, r, channel, fillet), row);
}

/** Points to an SVG path, transposed back for stacked steps (each arc then turns the other way). */
function toPath(points: Point[], row: boolean) {
  return (
    points
      .map(({ x, y, r: radius, sweep }, i) => {
        const [px, py] = row ? [x, y] : [y, x];
        if (i === 0) return `M${px},${py}`;
        if (radius === undefined) return `L${px},${py}`;
        return `A${radius} ${radius} 0 0 ${row ? sweep : 1 - (sweep ?? 0)} ${px},${py}`;
      })
      .join("") + "Z"
  );
}

/** A rectangle with its top and bottom corners rounded by `rTop` / `rBottom` (0: square), drawn clockwise. */
function roundedRect(x0: number, y0: number, x1: number, y1: number, rTop: number, rBottom: number) {
  const arc = (r: number, x: number, y: number) => (r ? `A${r} ${r} 0 0 1 ${x},${y}` : "");
  return (
    `M${x0},${y0 + rTop}${arc(rTop, x0 + rTop, y0)}` +
    `L${x1 - rTop},${y0}${arc(rTop, x1, y0 + rTop)}` +
    `L${x1},${y1 - rBottom}${arc(rBottom, x1 - rBottom, y1)}` +
    `L${x0 + rBottom},${y1}${arc(rBottom, x0, y1 - rBottom)}Z`
  );
}

/**
 * Phones: the steps stacked in one frame, a straight separator shared by two steps (at `cuts`).
 * The frame and its separators are drawn once (`d`); each step also gets its own loop (`loops`)
 * for a glint to run round, so the light goes round every step without doubling back.
 */
function stackedFrame(width: number, height: number, cuts: number[]) {
  // Half a pixel in, so the 1px stroke lands on whole pixels.
  const left = 0.5;
  const top = 0.5;
  const right = width - 0.5;
  const bottom = height - 0.5;
  const r = Math.min(RADIUS, (right - left) / 2);
  const edges = [top, ...cuts, bottom];
  const last = edges.length - 2;
  const loops = edges.slice(0, -1).map((y0, i) => roundedRect(left, y0, right, edges[i + 1], i === 0 ? r : 0, i === last ? r : 0));
  const d = roundedRect(left, top, right, bottom, r, r) + cuts.map((y) => `M${left},${y}L${right},${y}`).join("");
  return { d, loops };
}

// The path only fades in: a blur entrance would leave an inline `filter` on it.
const fadeIn: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.8 } } };

/** Landing section: the three steps the coach takes the member through, inside one lit outline. */
export function Features() {
  const frameRef = useRef<HTMLDivElement>(null);
  // The outline, and on phones one loop per step for the glints (in a row, they run the outline).
  const [frame, setFrame] = useState<{ w: number; h: number; d: string; loops: string[] | null } | null>(null);

  // Redrawn whenever the layout changes (width, stacking, text wrapping, fonts).
  useBrowserLayoutEffect(() => {
    const wrapper = frameRef.current;
    if (!wrapper) return;
    const measure = () => {
      const steps = Array.from(wrapper.querySelectorAll<HTMLElement>("li"));
      if (steps.length < 2) return;
      // offset*: layout boxes, untouched by the entrance transform; half a pixel in, so a 1px
      // stroke lands on whole pixels.
      const boxes = steps.map((li) => ({ x: li.offsetLeft + 0.5, y: li.offsetTop + 0.5, w: li.offsetWidth - 1, h: li.offsetHeight - 1 }));
      const row = boxes[1].x >= boxes[0].x + boxes[0].w;
      const [w, h] = [wrapper.offsetWidth, wrapper.offsetHeight];
      // In a row, separate steps joined by channels; stacked (phones), glued with shared separators.
      setFrame(
        row
          ? { w, h, d: stepsPath(boxes, row), loops: null }
          : { w, h, ...stackedFrame(w, h, steps.slice(1).map((li) => li.offsetTop + 0.5)) },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, []);

  return (
    <RevealSection id="features" className="px-4 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <RevealItem className="mb-12 text-center md:mb-16">
          <h2 className="landing-title text-balance font-display text-[32px] md:text-[48px]">
            Lance ton <span className="text-highlight">business</span> avec{" "}
            {/* Gus's face right before his name, set in the text like a letter: 1em tall, its middle
                on the middle of the capitals (0.77em tall in Unbounded, so 0.385em above the
                baseline), hence 0.115em below the baseline. The name stays on the baseline. */}
            <span className="whitespace-nowrap">
              <CoachAvatar online className="ml-[0.1em] mr-[0.22em] inline-block h-[1em] w-[1em] align-[-0.115em]" />
              {COACH_NAME}
            </span>
          </h2>
        </RevealItem>

        {/* The steps sit on the page, inside one lit outline (behind them): from md in a row, each
            framed and joined by channels; on phones stacked in one frame, a separator between two. */}
        <div ref={frameRef} className="relative">
          {frame && (
            <motion.svg
              aria-hidden
              variants={fadeIn}
              width={frame.w}
              height={frame.h}
              viewBox={`0 0 ${frame.w} ${frame.h}`}
              className="pointer-events-none absolute inset-0 overflow-visible"
            >
              <path d={frame.d} className="steps-path" />
              {frame.loops ? (
                // One glint round each step, each a third of a lap behind the previous one.
                frame.loops.map((loop, i) => (
                  <path key={i} d={loop} pathLength={1000} className="steps-glint steps-glint-loop" style={{ animationDelay: `${(-i * 8) / 3}s` }} />
                ))
              ) : (
                <path d={frame.d} pathLength={1000} className="steps-glint" />
              )}
            </motion.svg>
          )}

          {/* From md, the gaps are the channels' length; stacked, the steps touch (one separator). */}
          <ol className="flex flex-col md:flex-row md:gap-5">
            {FEATURES.map(({ Scene, title, detail }, i) => (
              <motion.li key={title} variants={revealItem} className="relative min-w-0 flex-1 p-4 md:p-5">
                {/* The step happening, as a small animated scene (StepScenes.tsx). */}
                <Scene />
                <div className="space-y-2 px-2 pb-2 pt-5">
                  <p className="font-display text-base text-primary">{i + 1}.</p>
                  <h3 className="font-display text-lg font-normal">{title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{detail}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </RevealSection>
  );
}
