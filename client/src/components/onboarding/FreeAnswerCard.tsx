import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "./Checkbox";
import { optionCardClass, SelectionWash } from "./OptionCard";
import { stepAppear } from "./StepHeader";
import type { OnboardingOption } from "./steps";

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/** Row of the card: same paddings and text as the other rows of the step, so it has the same weight. */
const ROW_CLASS = "relative flex w-full items-center gap-4 py-3 pl-3 pr-5 text-left md:gap-5 md:py-4 md:pl-4 md:pr-6";
const LABEL_CLASS = "text-base font-semibold md:text-lg";

/**
 * "Autre": a card like the others of the step. A tap picks it and turns its label into a field, on
 * the same line, so the card keeps its height (nothing moves, "Continuer" stays in place). The
 * answer is kept as it is typed; Enter, the tick or leaving the field closes it, and the card then
 * shows the written answer. Left empty, the pick is undone. Tapping the answer again edits it
 * (single choice) or removes it (multiple choice).
 */
export function FreeAnswerCard({
  option,
  variant,
  selected,
  text,
  onPick,
  onText,
  onRemove,
  testId,
}: {
  option: OnboardingOption & { free: NonNullable<OnboardingOption["free"]> };
  variant: "single" | "multi";
  selected: boolean;
  /** Written answer so far. */
  text: string;
  /** Picks the card (the field opens). */
  onPick: () => void;
  onText: (text: string) => void;
  /** Undoes the pick. */
  onRemove: () => void;
  testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const shown = selected && !!clean(text) && !editing;
  const highlighted = selected || editing;
  const multi = variant === "multi";

  const finish = () => {
    setEditing(false);
    const value = clean(text);
    if (value) onText(value);
    else onRemove();
  };

  const icon = option.icon && (
    <motion.span
      aria-hidden
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center transition-colors duration-200 md:h-12 md:w-12",
        highlighted ? "text-primary" : "text-muted-foreground",
      )}
      animate={!multi && highlighted ? { scale: 1.15, rotate: -8 } : { scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
    >
      <option.icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.75} />
    </motion.span>
  );

  return (
    <motion.div variants={stepAppear} className={cn(optionCardClass(highlighted), "col-span-full")}>
      <SelectionWash selected={highlighted} />

      {editing ? (
        <div className={ROW_CLASS}>
          {icon}
          <input
            value={text}
            maxLength={option.free.maxLength}
            placeholder={option.free.placeholder}
            autoFocus
            enterKeyHint="done"
            onChange={(event) => onText(event.target.value)}
            onBlur={finish}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            aria-label={option.free.placeholder}
            className={cn(LABEL_CLASS, "min-w-0 flex-1 bg-transparent outline-none placeholder:font-normal placeholder:text-muted-foreground")}
            data-testid="input-onboarding-free"
          />
          {/* Mouse down would blur the field first: the click itself closes it. */}
          <button
            type="button"
            aria-label="Valider ma réponse"
            onMouseDown={(event) => event.preventDefault()}
            onClick={finish}
            disabled={!clean(text)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          role={multi ? "checkbox" : "radio"}
          aria-checked={selected}
          onClick={() => {
            if (shown && multi) return onRemove();
            if (!selected) onPick();
            setEditing(true);
          }}
          className={cn(ROW_CLASS, "focus-visible:outline-none")}
          data-testid={testId}
        >
          {icon}
          <span className="relative min-w-0 flex-1">
            <span className={cn("block truncate", LABEL_CLASS)}>{shown ? clean(text) : option.label}</span>
            {shown && <span className="block text-xs leading-4 text-muted-foreground">{multi ? "Cliquer pour retirer" : "Modifier ma réponse"}</span>}
          </span>
          {/* Multiple choice rows have a checkbox; single choice rows have none. */}
          {multi && <Checkbox checked={selected} />}
        </button>
      )}
    </motion.div>
  );
}
