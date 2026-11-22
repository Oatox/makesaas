import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { potential, potentialRows } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import { TypewriterText } from "./TypewriterText";

// Once the title is typed: the gauge fills, the rows come in one by one while it fills, then
// their dashes light up from the left (seconds).
const GAUGE_DELAY = 0.15;
const FIRST_ROW = 0.5;
const ROW_GAP = 0.18;
const DASH_GAP = 0.07;

// Half circle of the gauge: center and radius in the SVG's units, stroke width.
const CX = 120;
const CY = 120;
const R = 100;
const STROKE = 16;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

/** Point of the half circle at `share` (0 = left end, 1 = right end), at `radius`. */
const pointAt = (share: number, radius = R) => {
  const angle = Math.PI * (1 - share);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
};

// Faint graduations along the half circle: the empty gauge reads as empty, the fill covers them.
const TICKS = Array.from({ length: 31 }, (_, i) => {
  const share = i / 30;
  return { share, from: pointAt(share, R - STROKE / 2 + 3), to: pointAt(share, R + STROKE / 2 - 3) };
});

/**
 * Half circle filling up to the score, the score counting up under it in step, and a small dot
 * riding the end of the fill.
 */
function Gauge({ score, play }: { score: number; play: boolean }) {
  const reduceMotion = useReducedMotion();
  const share = useMotionValue(reduceMotion ? score / 100 : 0);
  const shown = useTransform(share, (s) => Math.round(s * 100));
  const dotX = useTransform(share, (s) => pointAt(s).x);
  const dotY = useTransform(share, (s) => pointAt(s).y);
  // Nothing of the fill shows before it starts (a round cap would leave a blob at the start).
  const started = useTransform(share, (s) => (s > 0.005 ? 1 : 0));

  useEffect(() => {
    if (reduceMotion || !play) return;
    const controls = animate(share, score / 100, { delay: GAUGE_DELAY, duration: 1.6, ease: EASE_OUT });
    return () => controls.stop();
  }, [score, share, reduceMotion, play]);

  return (
    <div
      className="relative mx-auto w-full max-w-[320px] [@media(min-height:721px)_and_(max-height:820px)]:max-w-[260px] [@media(max-height:720px)]:max-w-[210px]"
      role="img"
      aria-label={`${score} de potentiel sur 100`}
    >
      <svg viewBox={`0 0 ${CX * 2} ${CY + STROKE}`} className="w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="potential-fill" x1="0" x2="1">
            <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
            <stop offset="1" stopColor="hsl(var(--primary))" />
          </linearGradient>
        </defs>
        {/* Graduations, then the fill drawn over them up to the score. */}
        {TICKS.map((tick) => (
          <line
            key={tick.share}
            x1={tick.from.x}
            y1={tick.from.y}
            x2={tick.to.x}
            y2={tick.to.y}
            stroke="hsl(var(--foreground) / 0.14)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}
        <motion.path
          d={ARC}
          fill="none"
          stroke="url(#potential-fill)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          style={{ pathLength: share, opacity: started }}
        />
        {/* Small white dot inside the end of the fill. */}
        <motion.circle cx={dotX} cy={dotY} r={STROKE / 2 - 4} fill="hsl(var(--foreground))" style={{ opacity: started }} />
      </svg>

      {/* Score inside the half circle. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <motion.span
          className="font-display text-[64px] font-light leading-none tracking-[-0.04em] tabular-nums [@media(min-height:721px)_and_(max-height:820px)]:text-[52px] [@media(max-height:720px)]:text-[44px] md:[@media(min-height:821px)]:text-[76px]"
        >
          {shown}
        </motion.span>
        <span className="mt-1 text-sm text-muted-foreground">de potentiel</span>
      </div>
    </div>
  );
}

const rowIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/** Five dashes, the first `level` lighting up one after the other, `delay` seconds after `play`. */
function Level({ level, play, delay }: { level: number; play: boolean; delay: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <span aria-hidden className="flex gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="relative h-1 w-3 overflow-hidden rounded-full bg-muted-foreground/25">
          {i < level && (
            <motion.span
              className="absolute inset-0 origin-left rounded-full bg-primary"
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={play ? { scaleX: 1 } : undefined}
              transition={{ delay: delay + i * DASH_GAP, duration: 0.25, ease: EASE_OUT }}
            />
          )}
        </span>
      ))}
    </span>
  );
}

/** "Ton potentiel": a score computed from the answers, on a half circle, and what it is made of. */
export function PotentialStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const score = potential(answers);
  // The title types out first; the hint, the gauge and the rows wait for it.
  const [typed, setTyped] = useState(false);

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
      {/* Same size as every step's title, on balanced lines. */}
      <div className="space-y-2 text-center">
        <h1 className={cn(STEP_TITLE_CLASS, "text-balance")}>
          <TypewriterText text="Tu as ce qu'il faut pour atteindre ton objectif." onDone={() => setTyped(true)} />
        </h1>
        {/* Own animate: it waits for the typing instead of following the step's stagger. */}
        <motion.p
          variants={stepAppear}
          initial="hidden"
          animate={typed ? "visible" : "hidden"}
          className="text-base text-muted-foreground md:text-lg"
        >
          Il ne te manque plus qu'une méthode claire.
        </motion.p>
      </div>

      {/* Gauge, rows and spacing shrink on short screens: the screen never scrolls. */}
      <div className="flex flex-1 flex-col justify-center py-6 [@media(max-height:820px)]:py-3">
        {/* No entrance animation around the figure: a filter on its parent would blur the count. */}
        <Gauge score={score} play={typed} />

        <motion.dl
          className="mt-8 divide-y divide-border [@media(max-height:820px)]:mt-4"
          variants={{ visible: { transition: { staggerChildren: ROW_GAP, delayChildren: FIRST_ROW } } }}
          initial="hidden"
          animate={typed ? "visible" : "hidden"}
        >
          {potentialRows(answers).map((row, i) => (
            <motion.div
              key={row.label}
              variants={rowIn}
              className="flex items-center justify-between gap-4 py-3.5 [@media(max-height:820px)]:py-2.5"
            >
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="flex items-center gap-3 text-right font-semibold">
                {row.value}
                {row.level !== null && <Level level={row.level} play={typed} delay={FIRST_ROW + i * ROW_GAP + 0.35} />}
              </dd>
            </motion.div>
          ))}
        </motion.dl>
      </div>

      <ContinueButton onClick={onContinue} variants={stepAppear} label="Débloquer mon potentiel" />
    </motion.div>
  );
}
