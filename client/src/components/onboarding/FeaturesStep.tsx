import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { ContinueButton } from "./ContinueButton";
import { fillTemplate } from "./insights";
import { RichText } from "./RichText";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import type { FeaturesStep as FeaturesStepConfig } from "./steps";

/** What the product does, one slide at a time ("Suivant"), dots underneath. */
export function FeaturesStep({ step, answers, onContinue }: { step: FeaturesStepConfig; answers: OnboardingAnswers; onContinue: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = step.slides[index];
  const last = index === step.slides.length - 1;

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            className="flex flex-col items-center"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <motion.span
              aria-hidden
              initial={{ scale: 0.7, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-primary/30 bg-primary/10 text-primary shadow-[0_0_48px_-8px_hsl(var(--primary)/0.55)] md:h-28 md:w-28"
            >
              <slide.icon className="h-11 w-11 md:h-12 md:w-12" strokeWidth={1.6} />
            </motion.span>
            <h1 className={`${STEP_TITLE_CLASS} mt-8 max-w-[560px] text-balance`}>{slide.title}</h1>
            <p className="mt-4 max-w-[460px] text-lg leading-relaxed text-muted-foreground">
              <RichText text={fillTemplate(slide.body, answers)} boldClassName="font-semibold text-primary" />
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex gap-1.5" aria-hidden>
          {step.slides.map((s, i) => (
            <span key={s.title} className={cn("h-1.5 rounded-full transition-all duration-300", i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")} />
          ))}
        </div>
      </div>

      <ContinueButton onClick={() => (last ? onContinue() : setIndex(index + 1))} variants={stepAppear} label="Suivant" />
    </motion.div>
  );
}
