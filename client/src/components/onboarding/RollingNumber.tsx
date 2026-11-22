import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue, type ValueAnimationTransition } from "framer-motion";
import { cn } from "@/lib/utils";

const DIGITS = Array.from({ length: 10 }, (_, i) => i);
const DIGIT_HEIGHT_EM = 1.1;
// Expo-out: fast spin, long soft landing, like a lottery drum slowing down.
const EASE = [0.16, 1, 0.3, 1] as const;
// Later changes (a slider moving): each reel rolls to its new digit, quick and springy.
const ROLL = { type: "spring", stiffness: 210, damping: 26 } as const;
const MAX_TURNS = 6;

type Props = {
  value: number;
  /** Static text before the number ("+"). */
  prefix?: string;
  /** Static text after the number ("%"). */
  suffix?: string;
  /** Delay before the reels start, in seconds. */
  delay?: number;
  className?: string;
  digitClassName?: string;
};

/** One digit face, placed around the reel's current position (the reel wraps: 9 sits right above 0). */
function Face({ digit, position, className }: { digit: number; position: MotionValue<number>; className?: string }) {
  const y = useTransform(position, (p) => {
    let offset = (((digit - p) % 10) + 10) % 10;
    if (offset > 5) offset -= 10;
    return `${offset * DIGIT_HEIGHT_EM}em`;
  });
  return (
    <motion.span style={{ y }} className={cn("absolute inset-x-0 top-0 block h-[1.1em] leading-[1.1em]", className)}>
      {digit}
    </motion.span>
  );
}

/**
 * A circular reel, like a slot machine or an odometer. `position` counts steps (digit = position
 * mod 10), so it can turn forever: going up always rolls forward (9 → 0 is one step), going down
 * always rolls backward.
 */
function Reel({
  digit,
  direction,
  opening,
  className,
}: {
  digit: number;
  /** +1 when the number went up, -1 when it went down. */
  direction: number;
  /** Spin on first display (turns and timing); null to roll straight to the digit. */
  opening: { turns: number; delay: number; duration: number } | null;
  className?: string;
}) {
  const position = useMotionValue(0);
  const target = useRef(0);
  const started = useRef(false);
  // Transition of the move in progress, so an effect re-run (StrictMode) resumes it unchanged.
  const transition = useRef<ValueAnimationTransition<number>>(ROLL);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      if (opening) {
        target.current = opening.turns * 10 + digit;
        transition.current = { delay: opening.delay, duration: opening.duration, ease: EASE };
      } else {
        target.current = digit;
      }
    } else {
      const current = ((target.current % 10) + 10) % 10;
      let step = digit - current;
      if (direction >= 0 && step < 0) step += 10;
      if (direction < 0 && step > 0) step -= 10;
      if (step !== 0) {
        target.current += step;
        transition.current = ROLL;
      }
    }

    if (position.get() === target.current) return;
    const move = animate(position, target.current, transition.current);
    return () => move.stop();
    // Re-run on a new digit only: the direction belongs to that same change.
  }, [digit]);

  return (
    <span aria-hidden className="relative inline-block h-[1.1em] overflow-hidden">
      {/* Gives the reel its width and height; the faces are positioned over it. */}
      <span className="invisible block h-[1.1em] leading-[1.1em]">0</span>
      {DIGITS.map((d) => (
        <Face key={d} digit={d} position={position} className={className} />
      ))}
    </span>
  );
}

/**
 * Slot-machine counter: every digit is a reel. On first display the reels spin and land on the
 * value one after the other (rightmost last). When the value changes, every reel rolls forward
 * (value up) or backward (value down) to its new digit; a digit that appears (950 → 1 000) rolls in.
 */
export function RollingNumber({ value, prefix, suffix, delay = 0, className, digitClassName }: Props) {
  const reduceMotion = useReducedMotion();
  const formatted = new Intl.NumberFormat("fr-FR").format(value);
  const chars = Array.from(formatted);
  const digitCount = chars.filter((c) => /\d/.test(c)).length;

  // Direction of the latest change, and whether the opening spin has been started.
  const previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  const mounted = useRef(false);
  useEffect(() => {
    previous.current = value;
  }, [value]);
  useEffect(() => {
    mounted.current = true;
  }, []);

  let digitFromRight = digitCount;

  return (
    <span className={cn("inline-flex items-start tabular-nums", className)} aria-label={`${prefix ?? ""}${formatted}${suffix ?? ""}`}>
      {prefix && (
        <span aria-hidden className={cn("block h-[1.1em] leading-[1.1em]", digitClassName)}>
          {prefix}
        </span>
      )}
      {chars.map((char, i) => {
        // Keyed from the right: the units reel stays the units reel when the number grows.
        const key = chars.length - i;
        if (!/\d/.test(char)) {
          // Group separator (narrow no-break space in fr-FR).
          return (
            <span key={`sep-${key}`} aria-hidden className="w-[0.22em]">
              {" "}
            </span>
          );
        }

        digitFromRight -= 1;
        if (reduceMotion) {
          return (
            <span key={key} aria-hidden className={cn("block h-[1.1em] leading-[1.1em]", digitClassName)}>
              {char}
            </span>
          );
        }

        // Rightmost reels turn more and longer, so they land last.
        const opening = mounted.current
          ? null
          : {
              turns: Math.max(2, MAX_TURNS - digitFromRight),
              delay,
              duration: 1.1 + (digitCount - 1 - digitFromRight) * 0.28,
            };

        return <Reel key={key} digit={Number(char)} direction={direction} opening={opening} className={digitClassName} />;
      })}
      {suffix && (
        <span aria-hidden className={cn("block h-[1.1em] leading-[1.1em]", digitClassName)}>
          {suffix}
        </span>
      )}
    </span>
  );
}
