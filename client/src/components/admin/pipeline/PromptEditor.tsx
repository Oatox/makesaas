import { useRef } from "react";
import type { Control } from "react-hook-form";
import { Check } from "lucide-react";
import { PROMPT_MAX_LENGTH, type AiPipelineUpdate } from "@shared/ai-pipeline";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PipelineStep } from "./pipeline-steps";

type PromptEditorProps = { control: Control<AiPipelineUpdate>; step: PipelineStep; variables: Record<string, string> };

/** Lines shown without scrolling: the editor grows with its prompt between these. */
const MIN_ROWS = 6;
const MAX_ROWS = 24;

/**
 * Editor of one prompt: grows with its text, the variables this prompt can use (the ones it uses
 * ticked, a click inserts one at the cursor) and a character counter.
 */
export function PromptEditor({ control, step, variables }: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <FormField
      control={control}
      name={step.field}
      render={({ field }) => {
        const value = field.value ?? "";
        const rows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, value.split("\n").length + 1));

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
                rows={rows}
                spellCheck={false}
                aria-label={step.label}
                className="h-auto min-h-0 resize-y font-mono text-[13px] leading-6 md:text-[13px]"
              />
            </FormControl>
            <FormMessage />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">Variables :</span>
                {step.variables.map((variable) => {
                  const used = value.includes(`{{${variable}}}`);
                  return (
                    <button
                      key={variable}
                      type="button"
                      title={`${variables[variable] ?? variable} · cliquer pour l'insérer`}
                      onClick={() => insertVariable(variable)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 font-mono text-xs transition-colors",
                        used
                          ? "border-success/30 bg-success/10 text-success hover:border-success/60"
                          : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {used && <Check className="size-3" aria-label="utilisée" />}
                      {`{{${variable}}}`}
                    </button>
                  );
                })}
              </div>
              <span
                className={cn(
                  "shrink-0 pt-1 text-xs tabular-nums text-muted-foreground",
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
