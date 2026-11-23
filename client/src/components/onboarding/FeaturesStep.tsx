import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { ContinueButton } from "./ContinueButton";
import { fillTemplate } from "./insights";
import { RichText } from "./RichText";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import { TypewriterText } from "./TypewriterText";
import type { FeaturesStep as FeaturesStepConfig } from "./steps";

const TITLE_CLASS = `${STEP_TITLE_CLASS} max-w-[560px] text-balance`;
const BODY_CLASS = "mt-4 max-w-[460px] text-lg leading-relaxed text-muted-foreground";

const avatarPop = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 260, damping: 18 } },
};

/**
 * What the product does, said by the coach: his face stays on top while his slides change ("Suivant"),
 * each title typed out as he writes it, then its text; dots underneath.
 */
export function FeaturesStep({ step, answers, onContinue }: { step: FeaturesStepConfig; answers: OnboardingAnswers; onContinue: () => void }) {
  const [index, setIndex] = useState(0);
  // Slide whose title is typed: tied to the slide, so a slide leaving mid-typing cannot show the next one's text.
  const [typedSlide, setTypedSlide] = useState(-1);
  const slide = step.slides[index];
  const last = index === step.slides.length - 1;

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible">
      {/* overflow-x-clip: the slides come in from the side; clipped, they never widen the page (no scrollbar). */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-x-clip text-center">
        <motion.div variants={avatarPop} className="mb-7 flex flex-col items-center gap-2.5">
          <CoachAvatar online className="h-20 w-20 md:h-24 md:w-24" />
          <span className="text-sm font-semibold text-primary">{COACH_NAME}</span>
        </motion.div>

        {/* Every slide's text, invisible, in the same grid cell as the shown one: the area keeps the
            tallest slide's height at any width, so the coach and the dots never move between slides. */}
        <div className="grid w-full">
          {step.slides.map((s) => (
            <div key={s.title} aria-hidden className="invisible col-start-1 row-start-1 flex flex-col items-center">
              <p className={TITLE_CLASS}>{fillTemplate(s.title, answers)}</p>
              <p className={BODY_CLASS}>
                <RichText text={fillTemplate(s.body, answers)} />
              </p>
            </div>
          ))}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              className="col-start-1 row-start-1 flex flex-col items-center self-start"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              <h1 className={TITLE_CLASS}>
                <TypewriterText text={fillTemplate(slide.title, answers)} startDelayMs={index === 0 ? 400 : 150} onDone={() => setTypedSlide(index)} />
              </h1>
              <motion.p
                className={BODY_CLASS}
                initial={{ opacity: 0, y: 8 }}
                animate={typedSlide === index ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              >
                <RichText text={fillTemplate(slide.body, answers)} boldClassName="font-semibold text-primary" />
              </motion.p>
            </motion.div>
          </AnimatePresence>
        </div>

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
