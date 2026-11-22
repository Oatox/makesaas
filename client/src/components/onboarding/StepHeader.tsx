import { useState } from "react";
import { motion } from "framer-motion";
import { blurIn } from "@/lib/motion";
import { TypewriterText } from "./TypewriterText";

// Same entrance as the landing and auth pages: fade in from a blur, slightly from below.
export const stepAppear = blurIn({ y: 14, blur: 8, duration: 0.55 });

export const STEP_TITLE_CLASS = "font-display text-[28px] font-semibold leading-tight sm:text-[32px] md:text-[40px]";

/** Question of a step, typed out letter by letter; the hint under it appears once the question is typed. */
export function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [typed, setTyped] = useState(false);

  return (
    <div className="space-y-2">
      <h1 className={STEP_TITLE_CLASS}>
        <TypewriterText text={title} onDone={() => setTyped(true)} />
      </h1>
      {subtitle && (
        // Own animate: it waits for the typing instead of following the step's stagger.
        <motion.p
          variants={stepAppear}
          initial="hidden"
          animate={typed ? "visible" : "hidden"}
          className="text-base text-muted-foreground md:text-lg"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
