import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { ContinueButton } from "./ContinueButton";
import { fillTemplate } from "./insights";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";

/** The conversation, in order: who speaks, what, and its timing (typing dots for the coach). */
const MESSAGES = [
  { from: "coach", text: "Je te trouve 3 idées, je prépare ton site et je te montre où sont tes clients.", waitMs: 400, typingMs: 800 },
  { from: "coach", text: "Puis je te construis ta roadmap jusqu'à {objectif} par mois.", waitMs: 250, typingMs: 700 },
  { from: "you", text: "Et moi, je fais quoi ?", waitMs: 1000, typingMs: 0 },
  { from: "coach", text: "Toi, tu as juste à appuyer sur le bouton.", waitMs: 250, typingMs: 750 },
] as const;

/** Plays the conversation: how many messages are shown, and whether the coach is typing the next one. */
function useConversation() {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState({ shown: reduceMotion ? MESSAGES.length : 0, typing: false });

  useEffect(() => {
    if (reduceMotion) return;
    const timers: number[] = [];
    let at = 0;
    MESSAGES.forEach((message, i) => {
      at += message.waitMs;
      if (message.typingMs > 0) {
        timers.push(window.setTimeout(() => setState({ shown: i, typing: true }), at));
        at += message.typingMs;
      }
      timers.push(window.setTimeout(() => setState({ shown: i + 1, typing: false }), at));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduceMotion]);

  return state;
}

const bubbleIn = { initial: { opacity: 0, y: 8, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.25 } };

/** "Je m'occupe de tout": the coach says what it takes care of; the visitor only has to press the button. */
export function CoachChatStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const { shown, typing } = useConversation();

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.h1 variants={stepAppear} className={STEP_TITLE_CLASS}>
        {fillTemplate("Je m'occupe de tout, {prenom}.", answers)}
      </motion.h1>

      <div className="mt-6 space-y-2" aria-live="polite">
        {shown > 0 && <p className="ml-12 text-xs font-semibold text-primary">{COACH_NAME}</p>}
        <AnimatePresence initial={false}>
          {MESSAGES.slice(0, shown).map((message, i) =>
            message.from === "you" ? (
              <motion.p
                key={i}
                {...bubbleIn}
                className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground"
              >
                {message.text}
              </motion.p>
            ) : (
              <motion.div key={i} {...bubbleIn} className="flex items-end gap-3">
                {/* The face sits by the last message of a run. */}
                <span className={cn(MESSAGES[i + 1]?.from === "coach" && i + 1 < shown + (typing ? 1 : 0) && "invisible")}>
                  <CoachAvatar />
                </span>
                <p
                  className={cn(
                    "max-w-[80%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-2.5 text-[15px] leading-relaxed",
                    i === MESSAGES.length - 1 && "border-primary/40 font-semibold",
                  )}
                >
                  {fillTemplate(message.text, answers)}
                </p>
              </motion.div>
            ),
          )}
          {typing && (
            <motion.div key="typing" {...bubbleIn} className="flex items-end gap-3">
              <CoachAvatar />
              <span className="flex gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3.5" aria-label={`${COACH_NAME} écrit`}>
                {[0, 1, 2].map((dot) => (
                  <motion.i
                    key={dot}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15 }}
                  />
                ))}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ContinueButton onClick={onContinue} variants={stepAppear} disabled={shown < MESSAGES.length} label="Construire mon business" />
    </motion.div>
  );
}
