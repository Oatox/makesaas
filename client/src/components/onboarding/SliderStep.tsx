import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { animate, motion, type AnimationPlaybackControls } from "framer-motion";
import { ContinueButton } from "./ContinueButton";
import { RollingNumber } from "./RollingNumber";
import { StepHeader, stepAppear } from "./StepHeader";
import type { SliderStep as SliderStepConfig } from "./steps";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// Spaces around the amount must not break: plain ones would collapse at the edge of the reels.
const NBSP = String.fromCharCode(160);

// Magnetic snap onto the nearest stop when the thumb is released.
const SNAP = { type: "spring", stiffness: 520, damping: 38 } as const;

/**
 * Amount picked on a big slider. The thumb follows the finger continuously, the amount shows the
 * nearest stop, and on release the thumb glides onto that stop. The last stop reads "et +".
 */
export function SliderStep({
  step,
  initial,
  onAnswer,
}: {
  step: SliderStepConfig;
  /** Amount saved earlier, so coming back to the step keeps it. */
  initial: number | undefined;
  onAnswer: (value: string) => void;
}) {
  const { values } = step;
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
  const format = (i: number) => `${euros.format(values[i])}${i === last ? " et +" : ""}`;

  return (
    <motion.div
      className="flex flex-1 flex-col md:flex-none"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <StepHeader title={step.title} subtitle={step.subtitle} />

      <div className="flex flex-1 flex-col justify-center py-10 md:flex-none md:py-14">
        {/* Slot-machine amount: spins in on arrival, then each reel rolls up or down with the slider.
            Not inside the blurred entrance below: a filter on a parent of the clipped-gradient
            digits glitches them. */}
        <div
          aria-hidden
          className="flex h-[1.1em] justify-center font-display text-[56px] font-semibold tracking-[-0.03em] sm:text-[64px] md:text-[80px]"
        >
          <RollingNumber
            value={value}
            suffix={`${NBSP}€${index === last ? `${NBSP}et${NBSP}+` : ""}`}
            delay={0.15}
            digitClassName="bg-gradient-to-b from-white from-30% to-white/60 bg-clip-text text-transparent"
          />
        </div>

        <motion.div variants={stepAppear}>
          <p className="mt-1 text-center text-lg text-muted-foreground" aria-hidden>
            {step.unit}
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
            aria-valuetext={`${format(index)} ${step.unit}`}
            className="range-lg mt-10"
            style={{ "--range-progress": position / last } as CSSProperties}
            data-testid={`onboarding-slider-${step.id}`}
          />
          <div className="mt-3 flex justify-between text-sm text-muted-foreground" aria-hidden>
            <span>{format(0)}</span>
            <span>{format(last)}</span>
          </div>
        </motion.div>
      </div>

      <ContinueButton onClick={() => onAnswer(String(value))} variants={stepAppear} />
    </motion.div>
  );
}
