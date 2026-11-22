import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { dreamWords } from "./insights";
import { RichText } from "./RichText";
import { stepAppear } from "./StepHeader";

const LINES = ["Ce qui te manque,", "c'est de passer à l'action", "avec une **méthode claire**"];
const LINE_DELAY = 0.45;

/** "La seule chose": every other excuse is gone, only taking action is left, for the visitor's dream. */
export function OneThingStep({ answers, onContinue }: { answers: OnboardingAnswers; onContinue: () => void }) {
  const reduceMotion = useReducedMotion();
  const dream = dreamWords(answers);
  // Without a dream to quote, the sentence ends on its last line.
  const lines = dream.length ? LINES : [...LINES.slice(0, -1), `${LINES[LINES.length - 1]}.`];
  const dreamDelay = 0.3 + LINE_DELAY * lines.length + 0.2;
  const [ready, setReady] = useState(!!reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setTimeout(() => setReady(true), (dream.length ? dreamDelay + 0.45 : dreamDelay - 0.2) * 1000);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, dream.length, dreamDelay]);

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {lines.map((line, i) => (
          <motion.p
            key={line}
            className={cn(
              "font-display leading-tight tracking-tight",
              i === 0 && lines.length > 1 ? "text-xl text-muted-foreground md:text-2xl" : "text-[30px] sm:text-[36px] md:text-[44px]",
            )}
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.3 + LINE_DELAY * i, duration: 0.5 }}
          >
            <RichText text={line} boldClassName="text-primary" />
          </motion.p>
        ))}

        {dream.length > 0 && (
          <motion.div
            className="mt-8 flex flex-col items-center gap-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dreamDelay, duration: 0.5 }}
          >
            <span className="text-base text-muted-foreground">pour atteindre ton rêve ultime, qui est :</span>
            {dream.map((word) => (
              <b key={word} className="text-lg font-semibold">
                « {word} »
              </b>
            ))}
          </motion.div>
        )}
      </div>

      <ContinueButton onClick={onContinue} variants={stepAppear} disabled={!ready} />
    </motion.div>
  );
}
