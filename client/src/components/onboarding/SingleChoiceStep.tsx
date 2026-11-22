import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ATTACHED_CARD_CLASS, AnswerPanel, detailReady } from "./AnswerFeedback";
import { ContinueButton, ContinueField } from "./ContinueButton";
import { FreeAnswerCard } from "./FreeAnswerCard";
import { optionCardClass, SelectionWash } from "./OptionCard";
import { StepHeader, stepAppear } from "./StepHeader";
import type { SingleChoiceStep as SingleChoiceStepConfig } from "./steps";

// Delay between the tap on an option and the next step, so the selection is visible.
const ADVANCE_DELAY_MS = 220;

/**
 * One answer among cards. When the options reply (note) or ask for more (field), the tap only
 * selects: the reply hangs under the picked card, as one block, the field grows out of
 * "Continuer", and "Continuer" confirms. Otherwise the tap advances.
 */
export function SingleChoiceStep({
  step,
  initial,
  initialDetail,
  onAnswer,
}: {
  step: SingleChoiceStepConfig;
  /** Answer saved earlier, so coming back to the step keeps it (confirmed steps only). */
  initial?: string;
  initialDetail?: string;
  /** `detail` is the text of the field, "" when the picked option has none; undefined when no option has a field. */
  onAnswer: (value: string, detail?: string) => void;
}) {
  const confirms = step.options.some((o) => o.note || o.input || o.free);
  const hasFields = step.options.some((o) => o.input || o.free);
  // "Autre" is written in its own card, full width under the others.
  const free = step.options.find((o) => o.free);
  const cards = step.options.filter((o) => !o.free);
  // Tap-to-advance steps start empty even when coming back: the highlight only marks the tap.
  const [selected, setSelected] = useState(confirms ? initial : undefined);
  const [detail, setDetail] = useState(initialDetail ?? "");
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const option = step.options.find((o) => o.value === selected);
  const ready = !!option && (option.free ? detail.trim().length > 0 : detailReady(option.input, detail));
  const hasPanel = confirms && !!option && !option.free && !!option.note;

  const submit = () => {
    if (!option || !ready) return;
    onAnswer(option.value, hasFields ? (option.input || option.free ? detail.trim() : "") : undefined);
  };

  const choose = (value: string) => {
    if (confirms) {
      // A detail belongs to the option it was written for.
      if (value !== selected && step.options.find((o) => o.value === value)?.input) setDetail("");
      setSelected(value);
      return;
    }
    if (timer.current) return; // already advancing
    setSelected(value);
    timer.current = window.setTimeout(() => onAnswer(value), ADVANCE_DELAY_MS);
  };

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
    >
      <StepHeader title={step.title} subtitle={step.subtitle} />

      {/* One column of cards on every screen size, a little bigger on desktop. Each card is
          followed by the slot of its panel, then the space before the next card. */}
      <div className="mt-7 flex flex-col" role="radiogroup" aria-label={step.title}>
        {cards.map((o, i) => {
          const isSelected = selected === o.value;
          return (
            <Fragment key={o.value}>
              <motion.button
                variants={stepAppear}
                whileTap={{ scale: 0.985 }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => choose(o.value)}
                className={cn(
                  optionCardClass(isSelected),
                  "flex w-full items-center gap-4 py-3 pl-3 pr-5 text-left md:gap-5 md:py-4 md:pl-4 md:pr-6",
                  isSelected && hasPanel && ATTACHED_CARD_CLASS,
                )}
                data-testid={`onboarding-option-${step.id}-${o.value}`}
              >
                <SelectionWash selected={isSelected} />
                {o.icon && (
                  <motion.span
                    aria-hidden
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center transition-colors duration-200 md:h-12 md:w-12",
                      isSelected ? "text-primary" : "text-muted-foreground",
                    )}
                    animate={isSelected ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  >
                    <o.icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.75} />
                  </motion.span>
                )}
                <span className="relative text-base font-semibold md:text-lg">{o.label}</span>
              </motion.button>

              <div className={cn((i < cards.length - 1 || free) && "pb-3 md:pb-4")}>
                <AnimatePresence initial={false}>
                  {hasPanel && isSelected && o.note && <AnswerPanel key={o.value} note={o.note} />}
                </AnimatePresence>
              </div>
            </Fragment>
          );
        })}

        {free?.free && (
          <FreeAnswerCard
            option={{ ...free, free: free.free }}
            variant="single"
            selected={selected === free.value}
            text={selected === free.value ? detail : ""}
            onPick={() => setSelected(free.value)}
            onText={setDetail}
            onRemove={() => {
              setSelected(undefined);
              setDetail("");
            }}
            testId={`onboarding-option-${step.id}-${free.value}`}
          />
        )}
      </div>

      {confirms && (
        <ContinueButton
          onClick={submit}
          variants={stepAppear}
          disabled={!ready}
          extension={
            option?.input && (
              <ContinueField
                label={option.input.label}
                placeholder={option.input.placeholder}
                value={detail}
                maxLength={option.input.maxLength}
                // A required answer gets the keyboard right away; an optional detail waits for a tap.
                autoFocus={!option.input.optional}
                onChange={setDetail}
                onSubmit={submit}
              />
            )
          }
        />
      )}
    </motion.div>
  );
}
