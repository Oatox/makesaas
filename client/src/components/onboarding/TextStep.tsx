import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tallInputClass } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { StepHeader, stepAppear } from "./StepHeader";
import type { TextStep as TextStepConfig } from "./steps";

/** A written answer: one line (first name) or a few (a sentence), optional or not. */
export function TextStep({
  step,
  initial,
  onAnswer,
}: {
  step: TextStepConfig;
  /** Text saved earlier, so coming back to the step keeps it. */
  initial: string | undefined;
  onAnswer: (value: string) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const text = value.replace(/\s+/g, " ").trim();
  const ready = step.optional || text.length > 0;

  const submit = () => {
    if (ready) onAnswer(text);
  };

  const fieldProps = {
    value,
    maxLength: step.maxLength,
    placeholder: step.placeholder,
    autoFocus: true,
    autoComplete: step.autoComplete ?? "off",
    "aria-label": step.title,
    "data-testid": `input-onboarding-${step.id}`,
  };

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <StepHeader title={step.title} subtitle={step.subtitle} />

      <motion.div variants={stepAppear} className="mt-8">
        {step.multiline ? (
          <Textarea {...fieldProps} rows={4} onChange={(event) => setValue(event.target.value)} className="min-h-[140px] resize-none rounded-[14px] px-5 py-4 text-lg md:text-xl" />
        ) : (
          <Input
            {...fieldProps}
            enterKeyHint="done"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              submit();
            }}
            // Bigger than the forms of the app: it is the only thing on screen.
            className={cn(tallInputClass, "h-14 rounded-[14px] px-5 text-lg md:h-16 md:text-xl")}
          />
        )}
      </motion.div>

      <ContinueButton onClick={submit} variants={stepAppear} disabled={!ready} label={step.cta} />
      {step.optional && (
        <motion.div variants={stepAppear} className="mt-2">
          <Button variant="ghost" className="h-11 w-full text-muted-foreground" onClick={() => onAnswer("")}>
            Passer cette étape
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
