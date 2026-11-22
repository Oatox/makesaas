import type { Transition, Variants } from "framer-motion";

/** Ease-out curve shared by the entrances of the site (fast start, long soft landing). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type BlurInOptions = {
  /** Start offset from below, in px. */
  y?: number;
  /** Start blur, in px. */
  blur?: number;
  /** Start scale (left untouched when omitted). */
  scale?: number;
  duration?: number;
  /** Replaces the default ease-out tween (e.g. a spring). */
  transition?: Transition;
};

/**
 * Entrance used across the site: fade in from a blur, slightly from below (`hidden` → `visible`).
 * `visible` accepts an optional delay as `custom`, which overrides the parent stagger.
 */
export function blurIn({ y = 10, blur = 10, scale, duration = 0.7, transition }: BlurInOptions = {}): Variants {
  const base: Transition = transition ?? { duration, ease: EASE_OUT };
  return {
    hidden: { opacity: 0, y, filter: `blur(${blur}px)`, ...(scale !== undefined ? { scale } : {}) },
    visible: (delay?: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      ...(scale !== undefined ? { scale: 1 } : {}),
      // A lingering filter would trap hover effects and `position: fixed` descendants; drop it once settled.
      transitionEnd: { filter: "none" },
      transition: delay === undefined ? base : { ...base, delay },
    }),
  };
}
