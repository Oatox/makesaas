import { useRef } from "react";
import { cn } from "@/lib/utils";
import { OnboardingDialog, OnboardingDialogHeader } from "./OnboardingDialog";
import { optionCardClass } from "./OptionCard";
import type { QuickQuestion } from "./steps";

/**
 * Quick question over a loading screen, in the onboarding's dialog: the loading waits for an
 * answer. Open while `question` is set; it keeps showing the last question while it slides out.
 */
export function QuickQuestionDialog({
  question,
  onAnswer,
}: {
  question: QuickQuestion | null;
  onAnswer: (questionId: string, value: string) => void;
}) {
  const last = useRef(question);
  if (question) last.current = question;
  const shown = question ?? last.current;

  return (
    <OnboardingDialog open={!!question} describedBy={!!shown?.detail}>
      {shown && (
        <>
          <OnboardingDialogHeader title={shown.question} description={shown.detail} />
          <div className="grid gap-2.5">
            {shown.options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={!question}
                onClick={() => onAnswer(shown.id, option.value)}
                className={cn(optionCardClass(false), "min-h-12 px-4 py-3 text-center text-base font-semibold")}
                data-testid={`onboarding-quick-${shown.id}-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </OnboardingDialog>
  );
}
