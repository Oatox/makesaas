import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { IconTile } from "./IconTile";
import { MESSAGE_VISUALS } from "./MessageVisuals";
import { RichText } from "./RichText";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import { TypewriterText } from "./TypewriterText";
import type { MessageStep as MessageStepConfig } from "./steps";

const iconPop = {
  hidden: { opacity: 0, scale: 0.7, rotate: -8 },
  visible: { opacity: 1, scale: 1, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 18 } },
};

/**
 * Explainer screen (the market, the model, the timing), centered: the kicker, the title typed out,
 * then, once it is typed, the illustration and the text. A screen without illustration has its icon
 * above the kicker instead, and sits in the middle of the page.
 */
export function MessageStep({ step, onContinue }: { step: MessageStepConfig; onContinue: () => void }) {
  const Visual = step.visual && MESSAGE_VISUALS[step.visual];
  const Icon = !Visual && step.icon;
  const [typed, setTyped] = useState(false);
  // Own animate on what follows the title: it waits for the typing instead of the step's stagger.
  const afterTyping = { variants: stepAppear, initial: "hidden", animate: typed ? "visible" : "hidden" } as const;

  return (
    <motion.div
      className="flex flex-1 flex-col text-center"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      <div className={cn("flex flex-col", !Visual && "flex-1 justify-center")}>
        {Icon && (
          <motion.span variants={iconPop} className="mx-auto mb-9">
            <IconTile icon={Icon} />
          </motion.span>
        )}

        <motion.p variants={stepAppear} className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {step.kicker}
        </motion.p>
        <h1 className={cn(STEP_TITLE_CLASS, "mx-auto mt-2 max-w-[560px] text-balance")}>
          <TypewriterText text={step.title} startDelayMs={350} onDone={() => setTyped(true)} />
        </h1>

        {Visual && (
          <motion.div {...afterTyping} className="card-3d mt-6 p-5 text-left">
            {/* Mounted once the title is typed, so its animation plays in view. */}
            {typed && <Visual />}
          </motion.div>
        )}

        {step.body && (
          <motion.p {...afterTyping} className="mx-auto mt-5 max-w-[480px] text-base leading-relaxed text-muted-foreground md:text-lg">
            <RichText text={step.body} />
          </motion.p>
        )}

        {step.points && (
          // Two per row.
          <motion.ul {...afterTyping} className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 text-left sm:gap-x-8">
            {step.points.map(({ icon: PointIcon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground md:text-base">
                <PointIcon aria-hidden className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
                <span>
                  <RichText text={text} />
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
