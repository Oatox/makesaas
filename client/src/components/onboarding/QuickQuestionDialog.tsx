import { useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { dialogContentClass, dialogMobileSheetClass, dialogOverlayClass } from "@/lib/dialog-styles";
import { cn } from "@/lib/utils";
import { optionCardClass } from "./OptionCard";
import type { QuickQuestion } from "./steps";

/**
 * Quick question over a loading screen, in the app's dialog: a bottom sheet on phones (safe
 * area), a centered modal from `sm` up, focus kept inside. It can't be dismissed: the
 * loading waits for an answer. Open while `question` is set; it keeps showing the last question
 * while it slides out.
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
  const keep = (event: Event) => event.preventDefault();

  return (
    <DialogPrimitive.Root open={!!question}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={dialogOverlayClass} />
        <DialogPrimitive.Content
          className={cn(dialogContentClass, dialogMobileSheetClass, "outline-none")}
          onEscapeKeyDown={keep}
          onPointerDownOutside={keep}
          onInteractOutside={keep}
          // Focus on the sheet, not on an answer: a focused answer would look picked already.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          {...(shown?.detail ? {} : { "aria-describedby": undefined })}
        >
          {shown && (
            <>
              <div>
                <DialogPrimitive.Title className="font-display text-2xl font-light leading-tight">{shown.question}</DialogPrimitive.Title>
                {shown.detail && <DialogPrimitive.Description className="mt-2 text-muted-foreground">{shown.detail}</DialogPrimitive.Description>}
              </div>
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
