import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { StepHeader, STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import type { WheelStep as WheelStepConfig } from "./steps";

/** Height of a row of the wheel, in px; five rows are visible, the middle one is the pick. */
const ROW = 46;
const VISIBLE = 5;
const PAD = ROW * Math.floor(VISIBLE / 2);

/** Look of a row by its distance to the pick: the pick stands out, its neighbors fade away. */
const ROW_CLASS = [
  "text-[30px] font-medium text-foreground",
  "text-[22px] font-light text-muted-foreground",
  "text-[22px] font-light text-muted-foreground/35",
  "text-[22px] font-light text-muted-foreground/15",
];

/**
 * Number picked on a wheel, like the iOS pickers (age): it scrolls with the finger, the mouse wheel
 * (one row per notch), a mouse drag or the arrow keys, and snaps onto a row. The first row can read
 * differently ("12 ou moins"). Under the minimum, the answer is refused with a message.
 */
export function WheelStep({
  step,
  initial,
  onAnswer,
}: {
  step: WheelStepConfig;
  /** Value saved earlier, so coming back to the step keeps it. */
  initial: number | undefined;
  onAnswer: (value: string) => void;
}) {
  const { min, max } = step;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const [value, setValue] = useState(clamp(initial ?? step.defaultValue));
  const [blocked, setBlocked] = useState(false);

  const list = useRef<HTMLDivElement>(null);
  // Row a smooth scroll is heading to: quick notches or key presses add up from it.
  const target = useRef<{ value: number; at: number } | null>(null);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  const scrollTo = (v: number, smooth = true) => {
    const next = clamp(v);
    target.current = { value: next, at: Date.now() };
    list.current?.scrollTo({ top: (next - min) * ROW, behavior: smooth ? "smooth" : "auto" });
  };
  const from = () => (target.current && Date.now() - target.current.at < 400 ? target.current.value : value);

  // Starts on the saved (or default) value, without animation.
  useEffect(() => {
    if (list.current) list.current.scrollTop = (value - min) * ROW;
    // Only on mount: later the scroll position drives the value.
  }, []);

  // One row per wheel notch (a plain wheel would jump several rows); small trackpad moves are ignored.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 50) return;
      event.preventDefault();
      scrollTo(from() + (event.deltaY > 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // The row under the band is the pick (React skips the render when it does not change).
  const onScroll = () => {
    const el = list.current;
    if (el) setValue(clamp(min + Math.round(el.scrollTop / ROW)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      scrollTo(event.key === "Home" ? min : max);
    } else if (event.key in moves) {
      event.preventDefault();
      scrollTo(from() + moves[event.key]);
    } else if (event.key === "Enter") {
      confirm();
    }
  };

  // A mouse can't drag-scroll natively: follow it, then snap onto the nearest row. Touch scrolls by itself.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !list.current) return;
    drag.current = { y: event.clientY, top: list.current.scrollTop, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = list.current;
    if (!drag.current || !el) return;
    const dy = event.clientY - drag.current.y;
    if (!drag.current.moved) {
      if (Math.abs(dy) < 4) return;
      drag.current.moved = true;
      el.setPointerCapture(event.pointerId);
      el.style.scrollSnapType = "none";
    }
    el.scrollTop = drag.current.top - dy;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const el = list.current;
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (!wasDrag || !el) return;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    scrollTo(min + Math.round(el.scrollTop / ROW));
    window.setTimeout(() => (el.style.scrollSnapType = ""), 250);
    // The click that ends a drag must not pick the row under the pointer.
    dragged.current = true;
    window.setTimeout(() => (dragged.current = false), 0);
  };

  const label = (v: number) => (v === min && step.firstLabel ? step.firstLabel : String(v));

  function confirm() {
    if (step.minimum && value < step.minimum.value) setBlocked(true);
    else onAnswer(String(value));
  }

  if (blocked && step.minimum) {
    return (
      <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
        <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
          {step.minimum.title}
        </motion.h1>
        <motion.p variants={stepAppear} className="mt-2 text-base text-muted-foreground md:text-lg">
          {step.minimum.text}
        </motion.p>
        <ContinueButton onClick={() => setBlocked(false)} variants={stepAppear} label={step.minimum.action} />
      </motion.div>
    );
  }

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
      <StepHeader title={step.title} subtitle={step.subtitle} />

      <motion.div variants={stepAppear} className="flex flex-1 items-center justify-center py-8">
        <div className="relative w-full" style={{ height: ROW * VISIBLE }}>
          {/* Band behind the picked row, with the unit next to the number. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 rounded-[14px] bg-secondary" style={{ top: PAD, height: ROW }}>
            {value !== min && (
              <span className="absolute left-1/2 top-1/2 ml-9 -translate-y-1/2 text-base text-muted-foreground">{step.unit}</span>
            )}
          </div>

          <div
            ref={list}
            role="spinbutton"
            tabIndex={0}
            aria-label={step.title}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={value === min && step.firstLabel ? step.firstLabel : `${value} ${step.unit}`}
            onScroll={onScroll}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[14px] outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-primary/50 [&::-webkit-scrollbar]:hidden"
            style={{ paddingBlock: PAD, cursor: "grab" }}
            data-testid={`onboarding-wheel-${step.id}`}
          >
            {values.map((v) => (
              <button
                key={v}
                type="button"
                tabIndex={-1}
                onClick={() => !dragged.current && scrollTo(v)}
                className={cn(
                  "flex w-full snap-center items-center justify-center font-display tabular-nums leading-none transition-[color,font-size] duration-150",
                  ROW_CLASS[Math.min(3, Math.abs(v - value))],
                )}
                style={{ height: ROW }}
              >
                {label(v)}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <ContinueButton onClick={confirm} variants={stepAppear} label="Valider" />
    </motion.div>
  );
}
