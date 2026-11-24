import { useState } from "react";
import { motion } from "framer-motion";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { ContinueButton } from "./ContinueButton";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import { TypewriterText } from "./TypewriterText";

const avatarPop = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 260, damping: 18 } },
};

/**
 * One sentence from the coach, alone on screen under his face, typed out; the button wakes up once it
 * is read. A `subtitle` appears under it once typed (the first mission of /lancement uses both).
 */
export function StatementStep({
  title,
  subtitle,
  label,
  onContinue,
}: {
  title: string;
  subtitle?: string;
  /** The button, "Continuer" by default. */
  label?: string;
  onContinue: () => void;
}) {
  const [typed, setTyped] = useState(false);

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div variants={avatarPop} className="mb-7 flex flex-col items-center gap-2.5">
          <CoachAvatar online className="h-20 w-20 md:h-24 md:w-24" />
          <span className="text-sm font-semibold text-primary">{COACH_NAME}</span>
        </motion.div>
        <h1 className={`${STEP_TITLE_CLASS} max-w-[600px] text-balance md:text-[48px]`}>
          <TypewriterText text={title} startDelayMs={400} onDone={() => setTyped(true)} />
        </h1>
        {subtitle && (
          <motion.p
            variants={stepAppear}
            initial="hidden"
            animate={typed ? "visible" : "hidden"}
            className="mt-4 max-w-[480px] text-balance text-base text-muted-foreground md:text-lg"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      <ContinueButton onClick={onContinue} variants={stepAppear} disabled={!typed} label={label} />
    </motion.div>
  );
}
