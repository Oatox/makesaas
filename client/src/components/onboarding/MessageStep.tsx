import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { ContinueButton } from "./ContinueButton";
import { RichText } from "./RichText";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import type { MessageStep as MessageStepConfig } from "./steps";

/** Explainer screen (what a SaaS is, the market, the model, the timing): illustration, kicker, title, text. */
export function MessageStep({ step, onContinue }: { step: MessageStepConfig; onContinue: () => void }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.span
          variants={{
            hidden: { opacity: 0, scale: 0.7, rotate: -8 },
            visible: { opacity: 1, scale: 1, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 18 } },
          }}
          aria-hidden
          className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-primary/30 bg-primary/10 text-primary shadow-[0_0_48px_-8px_hsl(var(--primary)/0.55)] md:h-28 md:w-28"
        >
          <step.icon className="h-11 w-11 md:h-12 md:w-12" strokeWidth={1.6} />
        </motion.span>

        <motion.p variants={stepAppear} className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {step.kicker}
        </motion.p>
        <motion.h1 variants={stepAppear} className={`${STEP_TITLE_CLASS} mt-2 max-w-[560px] text-balance`}>
          {step.title}
        </motion.h1>

        {step.body && (
          <motion.p variants={stepAppear} className="mt-4 max-w-[460px] text-lg leading-relaxed text-muted-foreground">
            <RichText text={step.body} />
          </motion.p>
        )}

        {step.points && (
          <motion.ul variants={stepAppear} className="card-3d mt-6 w-full max-w-[420px] space-y-3 p-5 text-left">
            {step.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-base text-muted-foreground">
                <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span>
                  <RichText text={point} />
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </div>

      <ContinueButton onClick={onContinue} variants={stepAppear} label="Suivant" />
    </motion.div>
  );
}
