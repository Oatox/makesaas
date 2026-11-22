import { useRef } from "react";
import type { Control } from "react-hook-form";
import { PROMPT_MAX_LENGTH, type AiPipelineUpdate } from "@shared/ai-pipeline";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PipelineStep } from "./pipeline-steps";

type PromptEditorProps = { control: Control<AiPipelineUpdate>; step: PipelineStep; variables: Record<string, string> };

/** Large editor for one pipeline message, with variable shortcuts and a character counter. */
export function PromptEditor({ control, step, variables }: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <FormField
      control={control}
      name={step.field}
      render={({ field }) => {
        const value = field.value ?? "";

        // Inserts at the cursor (or replaces the selection) and keeps the focus in the editor.
        const insertVariable = (variable: string) => {
          const textarea = textareaRef.current;
          const placeholder = `{{${variable}}}`;
          const start = textarea?.selectionStart ?? value.length;
          const end = textarea?.selectionEnd ?? value.length;

          field.onChange(value.slice(0, start) + placeholder + value.slice(end));
          requestAnimationFrame(() => {
            textarea?.focus();
            textarea?.setSelectionRange(start + placeholder.length, start + placeholder.length);
          });
        };

        return (
          <FormItem className="flex flex-col gap-3 space-y-0">
            <FormControl>
              <Textarea
                {...field}
                ref={(element) => {
                  field.ref(element);
                  textareaRef.current = element;
                }}
                value={value}
                spellCheck={false}
                aria-label={step.label}
                className="h-[min(55vh,560px)] min-h-[260px] resize-y font-mono text-[13px] leading-6 md:text-[13px]"
              />
            </FormControl>
            <FormMessage />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {step.showVariables ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs text-muted-foreground">Insérer :</span>
                  {Object.entries(variables).map(([variable, meaning]) => (
                    <button
                      key={variable}
                      type="button"
                      title={meaning}
                      onClick={() => insertVariable(variable)}
                      className="rounded-[8px] border border-border bg-secondary/60 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      {`{{${variable}}}`}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums text-muted-foreground",
                  value.length > PROMPT_MAX_LENGTH && "text-destructive",
                )}
              >
                {value.length.toLocaleString("fr-FR")} / {PROMPT_MAX_LENGTH.toLocaleString("fr-FR")} caractères
              </span>
            </div>
          </FormItem>
        );
      }}
    />
  );
}
