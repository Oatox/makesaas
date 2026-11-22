import { useState } from "react";
import { motion } from "framer-motion";
import { ContinueButton } from "./ContinueButton";
import { STEP_TITLE_CLASS, stepAppear } from "./StepHeader";
import { TypewriterText } from "./TypewriterText";

/** One sentence alone on screen, typed out; the button wakes up once it is read. */
export function StatementStep({ title, onContinue }: { title: string; onContinue: () => void }) {
  const [typed, setTyped] = useState(false);

  return (
    <motion.div className="flex flex-1 flex-col" initial="hidden" animate="visible">
      <div className="flex flex-1 items-center justify-center text-center">
        <h1 className={`${STEP_TITLE_CLASS} max-w-[600px] text-balance md:text-[48px]`}>
          <TypewriterText text={title} onDone={() => setTyped(true)} />
        </h1>
      </div>
      <ContinueButton onClick={onContinue} variants={stepAppear} disabled={!typed} />
    </motion.div>
  );
}
