import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { ContinueButton } from "./ContinueButton";
import { fillTemplate } from "./insights";
import { RichText } from "./RichText";
import { stepAppear } from "./StepHeader";
import type { ChatStep as ChatStepConfig } from "./steps";

/** Timing of the script (ms), as in the coach's chat (CoachChatStep): the visitor's lines pop in, the
 *  coach's come after typing dots, and an auto-advancing step moves on shortly after the last one
 *  (with reduced motion, everything shows at once, so it leaves time to read it all). */
const TIMING = {
  firstMessage: 700,
  beforeYou: 1000,
  beforeCoach: 500,
  betweenCoach: 250,
  coachTyping: (text: string) => Math.min(600 + text.length * 8, 1000),
  afterLast: 900,
  readingAll: 3000,
};

type ChatState = { shown: number; typing: boolean; done: boolean };

/** Plays the script: how many messages are shown, whether the coach is typing the next one, and
 *  `done` once it is time to move on. */
function useScript(messages: ChatStepConfig["messages"]): ChatState {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<ChatState>({ shown: 0, typing: false, done: false });

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, update: Partial<ChatState>) =>
      timers.push(window.setTimeout(() => setState((s) => ({ ...s, ...update })), ms));

    if (reduceMotion) {
      at(0, { shown: messages.length });
      at(TIMING.readingAll, { done: true });
    } else {
      let t = 0;
      messages.forEach((message, i) => {
        if (message.from === "you") {
          t += i === 0 ? TIMING.firstMessage : TIMING.beforeYou;
        } else {
          t += i === 0 ? TIMING.firstMessage : messages[i - 1].from === "coach" ? TIMING.betweenCoach : TIMING.beforeCoach;
          at(t, { shown: i, typing: true });
          t += TIMING.coachTyping(message.text);
        }
        at(t, { shown: i + 1, typing: false });
      });
      at(t + TIMING.afterLast, { done: true });
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [messages, reduceMotion]);

  return state;
}

const bubbleIn = { initial: { opacity: 0, y: 8, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.25 } };

/**
 * Short exchange with the coach, laid out like the coach's chat at the end of the onboarding
 * (CoachChatStep). With `autoAdvance`, the onboarding moves on by itself once the answer had time
 * to be read, and the button lets the visitor skip ahead; otherwise the button waits for the end.
 */
export function ChatStep({ step, answers, onContinue }: { step: ChatStepConfig; answers: OnboardingAnswers; onContinue: () => void }) {
  const { shown, typing, done } = useScript(step.messages);
  const visible = step.messages.slice(0, shown);
  const firstCoach = step.messages.findIndex((m) => m.from === "coach");
  const coachName = <p className="mb-2 ml-12 text-xs font-semibold text-primary">{COACH_NAME}</p>;

  // Moves on once only: the screen stays mounted while it fades out, so a click on the button right
  // before the auto-advance must not skip the next screen too. Latest callback in a ref, so the
  // script never restarts when the parent re-renders.
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;
  const movedOn = useRef(false);
  const moveOn = () => {
    if (movedOn.current) return;
    movedOn.current = true;
    onContinueRef.current();
  };
  useEffect(() => {
    if (done && step.autoAdvance) moveOn();
  }, [done, step.autoAdvance]);

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <div className="space-y-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {visible.map((message, i) =>
            message.from === "you" ? (
              <motion.p
                key={i}
                {...bubbleIn}
                className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground"
              >
                {fillTemplate(message.text, answers)}
              </motion.p>
            ) : (
              <motion.div key={i} {...bubbleIn}>
                {i === firstCoach && coachName}
                <div className="flex items-end gap-3">
                  {/* The face sits by the last message of a run (or by the typing dots that follow it). */}
                  <span className={cn((visible[i + 1]?.from === "coach" || (typing && i === visible.length - 1)) && "invisible")}>
                    <CoachAvatar />
                  </span>
                  <p className="max-w-[80%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-2.5 text-[15px] leading-relaxed">
                    <RichText text={fillTemplate(message.text, answers)} />
                  </p>
                </div>
              </motion.div>
            ),
          )}

          {typing && (
            <motion.div key="typing" {...bubbleIn}>
              {shown === firstCoach && coachName}
              <div className="flex items-end gap-3">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* With `autoAdvance` the button stays usable from the start, to skip ahead. */}
      <ContinueButton
        onClick={moveOn}
        variants={stepAppear}
        disabled={!step.autoAdvance && shown < step.messages.length}
        label={step.cta ?? "Suivant"}
      />
    </motion.div>
  );
}
