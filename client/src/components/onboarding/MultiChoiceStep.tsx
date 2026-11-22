import { Fragment, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ATTACHED_CARD_CLASS, AnswerPanel } from "./AnswerFeedback";
import { Checkbox } from "./Checkbox";
import { ContinueButton } from "./ContinueButton";
import { FreeAnswerCard } from "./FreeAnswerCard";
import { optionCardClass, SelectionWash } from "./OptionCard";
import { StepHeader, stepAppear } from "./StepHeader";
import type { MultiChoiceStep as MultiChoiceStepConfig, OnboardingOption } from "./steps";

/**
 * Several picks, as a checkable list: one row per answer (same rows as the single choice steps),
 * a checkbox on the right, confirmed with "Continuer". The reply to the last pick hangs under its
 * row, as one block; "Autre" comes last and the answer is written in its row.
 */
export function MultiChoiceStep({
  step,
  options,
  initial,
  initialDetail,
  onAnswer,
}: {
  step: MultiChoiceStepConfig;
  /** Options for the visitor (they may depend on an earlier answer). */
  options: OnboardingOption[];
  /** Picks saved earlier, so coming back to the step keeps them. */
  initial: string[];
  initialDetail?: string;
  /** `detail` is the text written for "Autre", "" without it. */
  onAnswer: (values: string[], detail: string) => void;
}) {
  const all = step.other ? [...options, step.other] : options;
  // Picks of options that are no longer offered (an earlier answer changed) are dropped.
  const [selected, setSelected] = useState<string[]>(() => initial.filter((v) => all.some((o) => o.value === v)));
  const [lastPick, setLastPick] = useState<string>();
  const [detail, setDetail] = useState(initialDetail ?? "");

  const otherPicked = !!step.other && selected.includes(step.other.value);
  const ready = selected.length > 0 && (!otherPicked || detail.trim().length > 0);
  // The last pick shows its reply, as long as it stays picked and has one.
  const noted = lastPick && selected.includes(lastPick) ? options.find((o) => o.value === lastPick && o.note) : undefined;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value));
      return;
    }
    setSelected([...selected, value]);
    setLastPick(value);
  };

  const submit = () => {
    if (ready) onAnswer(selected, otherPicked ? detail.trim() : "");
  };

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
    >
      <StepHeader title={step.title} subtitle={step.subtitle} />

      <div className="mt-7 flex flex-col" role="group" aria-label={step.title}>
        {options.map((option, i) => {
          const isSelected = selected.includes(option.value);
          const isNoted = noted === option;
          return (
            <Fragment key={option.value}>
              <motion.button
                variants={stepAppear}
                whileTap={{ scale: 0.985 }}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => toggle(option.value)}
                className={cn(
                  optionCardClass(isSelected),
                  "flex w-full items-center gap-4 py-3 pl-3 pr-5 text-left md:gap-5 md:py-4 md:pl-4 md:pr-6",
                  isNoted && ATTACHED_CARD_CLASS,
                )}
                data-testid={`onboarding-option-${step.id}-${option.value}`}
              >
                <SelectionWash selected={isSelected} />
                {option.icon && (
                  <span
                    aria-hidden
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center transition-colors duration-200 md:h-12 md:w-12",
                      isSelected ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <option.icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.75} />
                  </span>
                )}
                <span className="relative flex-1 text-base font-semibold md:text-lg">{option.label}</span>
                <Checkbox checked={isSelected} />
              </motion.button>

              {/* The reply of the last pick, then the space before the next row. */}
              <div className={cn((i < options.length - 1 || step.other) && "pb-3 md:pb-4")}>
                <AnimatePresence initial={false}>
                  {isNoted && option.note && <AnswerPanel key={option.value} note={option.note} />}
                </AnimatePresence>
              </div>
            </Fragment>
          );
        })}

        {step.other?.free && (
          <FreeAnswerCard
            option={{ ...step.other, free: step.other.free }}
            variant="multi"
            selected={otherPicked}
            text={otherPicked ? detail : ""}
            onPick={() => {
              setSelected([...selected, step.other!.value]);
              setLastPick(step.other!.value);
            }}
            onText={setDetail}
            onRemove={() => {
              setSelected(selected.filter((v) => v !== step.other!.value));
              setDetail("");
            }}
            testId={`onboarding-option-${step.id}-${step.other.value}`}
          />
        )}
      </div>

      <ContinueButton onClick={submit} variants={stepAppear} disabled={!ready} />
    </motion.div>
  );
}
