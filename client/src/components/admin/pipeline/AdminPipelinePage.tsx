import { useEffect, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Bot, ChevronDown, Loader2, RotateCcw, Save } from "lucide-react";
import {
  AI_TEXT_MODELS,
  aiPipelineUpdateSchema,
  type AiPipeline,
  type AiPipelineUpdate,
} from "@shared/ai-pipeline";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/StateCard";
import { useAiPipeline, useUpdateAiPipeline } from "@/hooks/use-ai-pipelines";
import { useToast } from "@/hooks/use-toast";
import { translateSupabaseError } from "@/lib/error-translator";
import { formatKickoff } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PIPELINE_CONFIGS, type PipelineConfig, type PipelineStep, type PromptFieldName } from "./pipeline-steps";
import { PromptEditor } from "./PromptEditor";

const toFormValues = (pipeline: AiPipeline): AiPipelineUpdate => ({
  model: pipeline.model,
  system_prompt: pipeline.system_prompt,
  data_prompt: pipeline.data_prompt,
  instructions_prompt: pipeline.instructions_prompt,
  output_format_prompt: pipeline.output_format_prompt,
});

export function AdminPipelinePage() {
  const [config, setConfig] = useState<PipelineConfig>(PIPELINE_CONFIGS[0]);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Pipelines" className="flex gap-2 overflow-x-auto">
        {PIPELINE_CONFIGS.map((item) => (
          <button
            key={item.slug}
            type="button"
            role="tab"
            aria-selected={item.slug === config.slug}
            onClick={() => setConfig(item)}
            className={cn(
              "flex shrink-0 flex-col rounded-full border border-border px-4 py-2 text-left transition-colors hover:border-foreground/25",
              item.slug === config.slug && "border-primary/60 bg-primary/10",
            )}
          >
            <span className="text-sm font-semibold">{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.hint}</span>
          </button>
        ))}
      </div>
      {/* Keyed by slug: switching pipeline remounts the form with its own values. */}
      <PipelineLoader key={config.slug} config={config} />
    </div>
  );
}

function PipelineLoader({ config }: { config: PipelineConfig }) {
  const pipeline = useAiPipeline(config.slug);

  if (pipeline.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-[18px]" />
        <Skeleton className="h-20 w-full rounded-[18px]" />
        <Skeleton className="h-[480px] w-full rounded-[18px]" />
      </div>
    );
  }

  if (pipeline.isError || !pipeline.data) {
    return (
      <ErrorState
        title="Pipeline introuvable"
        message={
          <>
            La table <code>ai_pipelines</code> n'existe pas encore ou ne contient pas le pipeline « {config.slug} ». Exécutez la
            section 14 de <code>supabase_setup.sql</code>.
          </>
        }
        className="p-6"
      />
    );
  }

  return <PipelineEditor pipeline={pipeline.data} config={config} />;
}

function PipelineEditor({ pipeline, config }: { pipeline: AiPipeline; config: PipelineConfig }) {
  const { toast } = useToast();
  const update = useUpdateAiPipeline(config.slug);
  const steps = config.steps;
  const [activeField, setActiveField] = useState<PromptFieldName>(steps[0].field);
  const form = useForm<AiPipelineUpdate>({
    resolver: zodResolver(aiPipelineUpdateSchema),
    defaultValues: toFormValues(pipeline),
  });
  const { isDirty, dirtyFields, errors } = form.formState;

  // Warn before leaving the page with unsaved prompt edits.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const onValid = async (values: AiPipelineUpdate) => {
    try {
      const saved = await update.mutateAsync(values);
      form.reset(toFormValues(saved));
      toast({ title: "Pipeline enregistré", description: "Les prochains appels à l'IA utiliseront ces prompts." });
    } catch (error) {
      toast({ variant: "destructive", ...translateSupabaseError(error) });
    }
  };

  // The invalid prompt may sit in another tab: bring it into view.
  const onInvalid = (fieldErrors: FieldErrors<AiPipelineUpdate>) => {
    const firstInvalid = steps.find((step) => fieldErrors[step.field]);
    if (firstInvalid) setActiveField(firstInvalid.field);
    toast({ variant: "destructive", title: "Pipeline invalide", description: "Corrigez l'étape signalée avant d'enregistrer." });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onValid, onInvalid)} className="flex flex-col gap-4">
        <header className="card-3d sticky top-0 z-20 flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-normal">{pipeline.name}</h2>
              <p className="truncate text-xs text-muted-foreground">
                OneShotAPI · modifié le <span className="capitalize">{formatKickoff(pipeline.updated_at)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modèle</span>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 w-full font-mono text-sm sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AI_TEXT_MODELS.map((model) => (
                        <SelectItem key={model} value={model} className="font-mono text-sm">
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2">
              {isDirty && <span className="hidden text-xs font-medium text-primary sm:inline">Non enregistré</span>}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => form.reset()}
                disabled={!isDirty || update.isPending}
              >
                <RotateCcw />
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={!isDirty || update.isPending}>
                {update.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Enregistrer
              </Button>
            </div>
          </div>
        </header>

        <TabsPrimitive.Root value={activeField} onValueChange={(value) => setActiveField(value as PromptFieldName)}>
          <TabsPrimitive.List
            aria-label="Messages envoyés au modèle, dans l'ordre"
            className="grid grid-cols-2 gap-2 md:grid-cols-4"
          >
            {steps.map((step, index) => (
              <StepTab
                key={step.field}
                step={step}
                index={index}
                isDirty={Boolean(dirtyFields[step.field])}
                hasError={Boolean(errors[step.field])}
              />
            ))}
          </TabsPrimitive.List>

          {steps.map((step, index) => (
            <TabsPrimitive.Content key={step.field} value={step.field} className="mt-4 focus-visible:outline-none">
              <section className="card-3d flex flex-col gap-4 p-4 sm:p-6">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-normal">
                      Étape {index + 1} · {step.label}
                    </h3>
                    <RoleBadge role={step.role} />
                  </div>
                  <p className="max-w-3xl text-sm text-muted-foreground">{step.description}</p>
                </div>
                <PromptEditor control={form.control} step={step} variables={config.variables} />
                {step.field === "output_format_prompt" && config.responseSchema && (
                  <EnforcedSchema schema={config.responseSchema} />
                )}
              </section>
            </TabsPrimitive.Content>
          ))}
        </TabsPrimitive.Root>
      </form>
    </Form>
  );
}

type StepTabProps = { step: PipelineStep; index: number; isDirty: boolean; hasError: boolean };

function StepTab({ step, index, isDirty, hasError }: StepTabProps) {
  return (
    <TabsPrimitive.Trigger
      value={step.field}
      className={cn(
        "group relative flex items-center gap-3 rounded-[14px] border border-border bg-card px-3.5 py-3 text-left transition-colors",
        "hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10",
        hasError && "border-destructive/60",
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
        {index + 1}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{step.label}</span>
        <span className="truncate text-xs text-muted-foreground">{step.hint}</span>
      </span>
      {(hasError || isDirty) && (
        <span
          aria-label={hasError ? "Erreur" : "Modifié"}
          className={cn("absolute right-2.5 top-2.5 size-2 rounded-full", hasError ? "bg-destructive" : "bg-primary")}
        />
      )}
    </TabsPrimitive.Trigger>
  );
}

function RoleBadge({ role }: { role: PipelineStep["role"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase",
        role === "system" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
      )}
    >
      {role}
    </span>
  );
}

function EnforcedSchema({ schema }: { schema: object }) {
  return (
    <Collapsible className="rounded-[12px] border border-border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
        Schéma JSON imposé par l'application (lecture seule)
        <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="max-h-80 overflow-auto border-t border-border bg-background/60 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify(schema, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
