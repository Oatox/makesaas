import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";
import { optionCardClass, SelectionWash } from "./OptionCard";
import { StepHeader, stepAppear } from "./StepHeader";
import type { MultiChoiceStep as MultiChoiceStepConfig } from "./steps";

/** Several picks shown as a grid of cards (2 columns on mobile, 4 on desktop), confirmed with "Continuer". */
export function MultiChoiceStep({
  step,
  initial,
  onAnswer,
}: {
  step: MultiChoiceStepConfig;
  /** Picks saved earlier, so coming back to the step keeps them. */
  initial: string[];
  onAnswer: (values: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initial);

  const exclusive = new Set(step.options.filter((o) => o.exclusive).map((o) => o.value));

  // An exclusive answer ("none of these") clears the other picks, and any other pick clears it.
  const toggle = (value: string) =>
    setSelected((current) => {
      if (current.includes(value)) return current.filter((v) => v !== value);
      return exclusive.has(value) ? [value] : [...current.filter((v) => !exclusive.has(v)), value];
    });

  return (
    <motion.div
      className="flex flex-1 flex-col md:flex-none"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
    >
      <StepHeader title={step.title} subtitle={step.subtitle} />

      <div className="mt-6 grid grid-cols-2 gap-2.5 md:mt-7 md:grid-cols-4 md:gap-3" role="group" aria-label={step.title}>
        {step.options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <motion.button
              key={option.value}
              variants={stepAppear}
              whileTap={{ scale: 0.97 }}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => toggle(option.value)}
              className={cn(
                optionCardClass(isSelected),
                option.exclusive
                  ? "col-span-2 flex items-center justify-center gap-3 px-4 py-3 md:col-span-4"
                  : "flex flex-col items-center gap-2 px-3 py-3 text-center md:gap-2.5 md:py-4",
              )}
              data-testid={`onboarding-option-${step.id}-${option.value}`}
            >
              <SelectionWash selected={isSelected} />

              {/* Tick in the corner: the selection does not rely on color alone. */}
              <span
                aria-hidden
                className={cn(
                  "absolute flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-200",
                  option.exclusive ? "right-3 top-1/2 -translate-y-1/2" : "right-2.5 top-2.5",
                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>

              {option.image ? (
                // Light tile: dark crests (Ligue 1, Premier League) stay readable on the dark card.
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm shadow-black/30 md:h-12 md:w-12 md:p-2">
                  <img src={option.image} alt="" width={56} height={56} loading="lazy" className="h-full w-full object-contain" />
                </span>
              ) : (
                option.icon && (
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground md:h-12 md:w-12">
                    <option.icon className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                )
              )}
              <span className="relative text-sm font-semibold leading-tight md:text-base">{option.label}</span>
            </motion.button>
          );
        })}
      </div>

      <ContinueButton onClick={() => onAnswer(selected)} variants={stepAppear} disabled={selected.length === 0} />
    </motion.div>
  );
}
