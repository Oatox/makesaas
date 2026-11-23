import { buzz } from "./haptics";
import { playMessageSound } from "./sounds";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Fingerprint } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { firstName } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

const HOLD_MS = 1500;
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const angle = ((-90 + 5 * i) * Math.PI) / 180;
  return { share: i / 72, x1: 100 + 84 * Math.cos(angle), y1: 100 + 84 * Math.sin(angle), x2: 100 + 96 * Math.cos(angle), y2: 100 + 96 * Math.sin(angle) };
});

/**
 * The fingerprint as a raised 3D button, same recipe as the buttons (.btn-3d in index.css): lighter
 * top, light rim, darker edge underneath for the thickness (no glow around it). Held down, it sinks
 * by most of its edge, like a key.
 */
const pressable = (color: string, pressed: boolean): CSSProperties => ({
  backgroundImage: `linear-gradient(to bottom, color-mix(in oklab, ${color}, white 22%), ${color})`,
  boxShadow: [
    "inset 0 1px 0 hsl(0 0% 100% / 0.45)",
    `inset 0 -3px 0 color-mix(in oklab, ${color}, black 30%)`,
    `0 ${pressed ? 2 : 6}px 0 color-mix(in oklab, ${color}, black 52%)`,
  ].join(", "),
  transform: pressed ? "translateY(4px)" : undefined,
});

/**
 * "Fais une promesse à toi-même": the coach asks for a promise, signed by holding a finger on the
 * ring (or Space / Enter) for 1.5 s. Once signed, the coach cheers in a notification and the
 * onboarding moves on.
 */
export function PactStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const [hold, setHold] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [cheer, setCheer] = useState(false);
  const frame = useRef(0);
  const timers = useRef<number[]>([]);
  const signed = hold >= 1;

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const start = () => {
    if (signed) return;
    setPressed(true);
    cancelAnimationFrame(frame.current);
    const from = performance.now() - HOLD_MS * hold;
    const tick = () => {
      const progress = Math.min(1, (performance.now() - from) / HOLD_MS);
      setHold(progress);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      buzz(30);
      setPressed(false);
      timers.current.push(
        window.setTimeout(() => {
          setCheer(true);
          playMessageSound();
        }, 450),
        window.setTimeout(onContinue, 2050),
      );
    };
    frame.current = requestAnimationFrame(tick);
  };

  // Letting go before the end starts over.
  const stop = () => {
    cancelAnimationFrame(frame.current);
    setPressed(false);
    if (!signed) setHold(0);
  };

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
    >
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        Fais une promesse à toi-même.
      </motion.h1>

      <motion.div variants={stepAppear} className="mt-6 flex items-start gap-3">
        <CoachAvatar />
        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-primary">{COACH_NAME}</p>
          <p className="mt-1 text-[15px] leading-relaxed">
            {firstName(answers)}, avant que je prépare ton plan, promets-moi de tout donner et de ne jamais abandonner.
          </p>
        </div>
      </motion.div>

      <motion.p variants={stepAppear} className="mt-6 text-center font-display text-xl leading-snug md:text-2xl">
        « Je m'engage à tout donner pour atteindre mes objectifs. »
      </motion.p>

      <motion.div variants={stepAppear} className="mt-6 flex flex-1 flex-col items-center justify-center pb-4">
        <button
          type="button"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onKeyDown={(event) => {
            if ((event.key === " " || event.key === "Enter") && !event.repeat) {
              event.preventDefault();
              start();
            }
          }}
          onKeyUp={stop}
          onContextMenu={(event) => event.preventDefault()}
          aria-label="Maintiens pour signer"
          className="relative h-48 w-48 cursor-pointer touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          data-testid="button-onboarding-sign"
        >
          <svg viewBox="0 0 200 200" className="absolute inset-0" aria-hidden>
            {TICKS.map((tick) => (
              <line
                key={tick.share}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                strokeWidth="3"
                strokeLinecap="round"
                stroke={tick.share < hold ? (signed ? "hsl(var(--success))" : "hsl(var(--primary))") : "hsl(0 0% 100% / 0.12)"}
              />
            ))}
          </svg>
          <span
            className="absolute inset-8 flex items-center justify-center overflow-hidden rounded-full text-white transition-[transform,box-shadow,background-image] duration-150 hover:brightness-110"
            style={pressable(signed ? "hsl(var(--success))" : "hsl(var(--primary))", pressed && !signed)}
          >
            {/* Gloss on the upper half. */}
            <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
            {signed ? (
              <Check className="relative h-11 w-11 drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]" strokeWidth={2.75} />
            ) : (
              <Fingerprint className="relative h-14 w-14 drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]" strokeWidth={1.75} />
            )}
          </span>
        </button>
        <p className="mt-3 text-center">
          <b className="block font-semibold">{firstName(answers)}</b>
          <span className="text-sm text-muted-foreground">{signed ? "Signé" : "Maintiens ton doigt pour signer"}</span>
        </p>
      </motion.div>

      {createPortal(
        <AnimatePresence>
          {cheer && (
            <motion.div
              role="status"
              className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-[420px] items-start gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur"
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <CoachAvatar />
              <span className="text-sm">
                <b className="block">
                  {COACH_NAME} <i className="font-normal not-italic text-muted-foreground">maintenant</i>
                </b>
                Bravo, tu y es presque. Encore une dernière étape et ton plan sera prêt 💪
              </span>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
}
