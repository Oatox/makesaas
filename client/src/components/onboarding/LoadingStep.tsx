import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderProgressBar } from "@/components/LoaderProgressBar";
import { useElapsed } from "@/hooks/use-elapsed";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { DotSphere } from "./DotSphere";
import { fillTemplate } from "./insights";
import { QuickQuestionDialog } from "./QuickQuestionDialog";
import type { LoadingStep as LoadingStepConfig, QuickQuestion } from "./steps";

const LINE_MS = 1600;

const appear = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/**
 * Loading screen paced on the clock (nothing is computed): a sphere of dots lighting up while the
 * lines scroll by, paused by quick questions. "Continuer" sends the quick answers along.
 */
export function LoadingStep({
  step,
  answers,
  onContinue,
}: {
  step: LoadingStepConfig;
  answers: OnboardingAnswers;
  onContinue: (quickAnswers: OnboardingAnswers) => void;
}) {
  // Asked again on every pass: the answers given here only count once the loading is done.
  const [quick, setQuick] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<QuickQuestion | null>(null);
  const elapsed = useElapsed(!pending);

  const totalMs = step.lines.length * LINE_MS;
  const progress = Math.min(1, elapsed / totalMs);
  const known = { ...answers, ...quick };

  // Pops the next question once the loading reaches it.
  useEffect(() => {
    if (pending) return;
    const due = step.questions.find((q) => !(q.id in quick) && (!q.when || q.when(known)) && progress >= q.at);
    if (due) setPending(due);
    // `known` is rebuilt on every render from the two values below.
  }, [progress, pending, quick, answers, step.questions]);

  const done = progress >= 1 && !pending;

  // Some loadings move on by themselves once done (the analysis), like a page turning.
  const finish = useRef(onContinue);
  finish.current = onContinue;
  useEffect(() => {
    if (!done || !step.autoAdvance) return;
    const timer = window.setTimeout(() => finish.current(quick), 600);
    return () => window.clearTimeout(timer);
  }, [done, step.autoAdvance, quick]);

  const line = Math.min(Math.floor(progress * step.lines.length), step.lines.length - 1);
  const title = fillTemplate(done ? step.doneTitle : step.title, known);
  const status = done ? fillTemplate(step.doneText, known) : `${fillTemplate(step.lines[line], known)}…`;

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-label={done ? title : `${title} : ${status}`}
        className="flex flex-1 flex-col items-center justify-center text-center"
      >
        <motion.div variants={appear} className="size-[240px] sm:size-[280px]">
          <DotSphere progress={progress} className="size-full" />
        </motion.div>

        <motion.div variants={appear} className="mt-4 w-full">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1
              key={done ? "done" : "running"}
              className="font-display text-[26px] font-light tracking-tight md:text-[32px]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {title}
            </motion.h1>
          </AnimatePresence>
          {step.subtitle && !done && <p className="mt-1 text-base text-muted-foreground">{fillTemplate(step.subtitle, known)}</p>}

          {/* The current line scrolls up and is replaced by the next one. */}
          <div className={cn("relative h-6 overflow-hidden text-base", step.subtitle && !done ? "mt-3 text-foreground/80" : "mt-1 text-muted-foreground")}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={done ? "done" : line}
                className="absolute inset-x-0 truncate"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                {status}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div variants={appear} className="mt-8 w-full max-w-[420px]">
          <LoaderProgressBar value={progress} done={done} />
        </motion.div>
      </div>

      {/* A loading that moves on by itself needs no button. */}
      {!step.autoAdvance && <ContinueButton onClick={() => onContinue(quick)} variants={appear} disabled={!done} label={step.cta} />}

      <QuickQuestionDialog
        question={pending}
        onAnswer={(id, value) => {
          setQuick((current) => ({ ...current, [id]: value }));
          setPending(null);
        }}
      />
    </motion.div>
  );
}
