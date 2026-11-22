import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { animate, AnimatePresence, motion, type AnimationPlaybackControls } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { RollingNumber } from "./RollingNumber";
import { StepHeader, stepAppear } from "./StepHeader";
import type { SliderStep as SliderStepConfig } from "./steps";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// Spaces around the amount must not break: plain ones would collapse at the edge of the reels.
const NBSP = String.fromCharCode(160);

// Magnetic snap onto the nearest stop when the thumb is released.
const SNAP = { type: "spring", stiffness: 520, damping: 38 } as const;

const DIGITS_CLASS = "bg-gradient-to-b from-white from-30% to-white/60 bg-clip-text text-transparent";

const swap = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: EASE_OUT },
};

/**
 * Value picked on a big slider: an amount or one word per stop. The thumb follows the
 * finger continuously, the display shows the nearest stop, and on release the thumb glides onto it.
 */
export function SliderStep({
  step,
  initial,
  onAnswer,
}: {
  step: SliderStepConfig;
  /** Value saved earlier, so coming back to the step keeps it. */
  initial: number | undefined;
  onAnswer: (value: string) => void;
}) {
  const { values, display } = step;
  const startIndex = values.indexOf(initial ?? step.defaultValue);
  // Continuous position between stops (0 = first stop, last = last stop).
  const [position, setPositionState] = useState(startIndex === -1 ? Math.max(0, values.indexOf(step.defaultValue)) : startIndex);
  // Mirror of the position for handlers that run outside React's render (release, animation).
  const positionRef = useRef(position);
  const setPosition = (next: number) => {
    positionRef.current = next;
    setPositionState(next);
  };
  const snapping = useRef<AnimationPlaybackControls | null>(null);
  // Stop the thumb is gliding to: quick key presses add up from it, not from where the thumb is.
  const glideTarget = useRef<number | null>(null);
  useEffect(() => () => snapping.current?.stop(), []);

  const last = values.length - 1;
  const index = Math.round(position);
  const value = values[index];

  const glideTo = (target: number) => {
    snapping.current?.stop();
    glideTarget.current = target;
    snapping.current = animate(positionRef.current, target, {
      ...SNAP,
      onUpdate: setPosition,
      onComplete: () => {
        glideTarget.current = null;
      },
    });
  };

  // The release can happen outside the input (finger slid off): listen on the window.
  const onPointerDown = () => {
    snapping.current?.stop();
    const release = () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      glideTo(Math.round(positionRef.current));
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
  };

  // Arrows, Home and End move stop by stop (a continuous input would otherwise crawl).
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const from = glideTarget.current ?? index;
    const moves: Record<string, number> = {
      ArrowRight: from + 1,
      ArrowUp: from + 1,
      ArrowLeft: from - 1,
      ArrowDown: from - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    glideTo(Math.min(last, Math.max(0, moves[event.key])));
  };

  /** Stop as read aloud and shown at the ends of the track. */
  const label = (i: number) => {
    if (display.kind === "euros") return euros.format(values[i]);
    return display.words[i];
  };
  const caption = display.kind === "words" ? display.sentences[index] : display.unit;
  const tier = step.tiers?.find((t) => value <= t.upTo);

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <StepHeader title={step.title} subtitle={step.subtitle} />

      <div className="flex flex-1 flex-col justify-center py-10 md:py-14">
        {display.kind === "words" ? (
          <div aria-hidden className="grid h-[1.2em] place-items-center font-display text-[36px] font-light tracking-[-0.03em] sm:text-[44px] md:text-[60px]">
            <AnimatePresence initial={false}>
              <motion.span key={index} {...swap} className={`col-start-1 row-start-1 whitespace-nowrap ${DIGITS_CLASS}`}>
                {display.words[index]}
              </motion.span>
            </AnimatePresence>
          </div>
        ) : (
          // Slot-machine figure: spins in on arrival, then each reel rolls up or down with the slider.
          // Not inside the blurred entrance below: a filter on a parent of the clipped-gradient
          // digits glitches them.
          <div
            aria-hidden
            className="flex h-[1.1em] justify-center font-display text-[56px] font-light tracking-[-0.03em] sm:text-[64px] md:text-[80px]"
          >
            <RollingNumber value={value} suffix={display.kind === "euros" ? `${NBSP}€` : undefined} delay={0.15} digitClassName={DIGITS_CLASS} />
          </div>
        )}

        <motion.div variants={stepAppear}>
          <p className="mt-1 min-h-[1.75rem] text-center text-lg text-muted-foreground" aria-hidden>
            {caption}
          </p>
          <input
            type="range"
            min={0}
            max={last}
            step="any"
            value={position}
            onChange={(event) => {
              snapping.current?.stop();
              glideTarget.current = null;
              setPosition(Number(event.target.value));
            }}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            aria-label={step.title}
            aria-valuetext={display.kind === "euros" ? `${label(index)} ${display.unit}` : label(index)}
            className="range-lg mt-10"
            style={{ "--range-progress": position / last } as CSSProperties}
            data-testid={`onboarding-slider-${step.id}`}
          />
          <div className="mt-3 flex justify-between text-sm text-muted-foreground" aria-hidden>
            <span>{label(0)}</span>
            <span>{label(last)}</span>
          </div>

          {tier && (
            <div className="mt-6 min-h-[3.5rem] text-center" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={tier.word} {...swap} className="text-[15px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-primary">{tier.word}</span> · {tier.note}
                </motion.p>
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      <ContinueButton onClick={() => onAnswer(String(value))} variants={stepAppear} />
    </motion.div>
  );
}
