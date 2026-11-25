import { Fragment, useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronRight,
  GalleryHorizontalEnd,
  Lightbulb,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  AI_TEXT_MODELS,
  aiPipelineUpdateSchema,
  type AiPipeline,
  type AiPipelineSlug,
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
import {
  getPipelineConfig,
  JOURNEY_STAGES,
  PIPELINE_CONFIGS,
  pipelinePath,
  sectionId,
  type FixedStep,
  type JourneyStage,
  type PipelineConfig,
  type PipelineStep,
  type PromptFieldName,
} from "./pipeline-steps";
import { PromptEditor } from "./PromptEditor";

const PIPELINE_ICONS: Partial<Record<AiPipelineSlug, LucideIcon>> = { coach: Bot, carousel: GalleryHorizontalEnd, ideas: Lightbulb };
const iconOf = (slug: AiPipelineSlug) => PIPELINE_ICONS[slug] ?? Sparkles;

/**
 * Unsaved edits of each pipeline, kept while the admin goes back to the list and opens another one
 * (lost on reload, which the browser warns about).
 */
const drafts = new Map<AiPipelineSlug, AiPipelineUpdate>();

/** Warns before a reload or a closed tab while edits are unsaved. */
function useWarnBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

const toFormValues = (pipeline: AiPipeline): AiPipelineUpdate => ({
  model: pipeline.model,
  system_prompt: pipeline.system_prompt,
  data_prompt: pipeline.data_prompt,
  instructions_prompt: pipeline.instructions_prompt,
  output_format_prompt: pipeline.output_format_prompt,
});

/** /admin/pipeline: the pipelines by part of the app; /admin/pipeline/:slug: one pipeline's prompts. */
export function AdminPipelinePage({ slug }: { slug?: string }) {
  if (!slug) return <PipelineList />;

  const config = getPipelineConfig(slug);
  if (!config) {
    return (
      <ErrorState
        title="Pipeline introuvable"
        message={
          <>
            Aucun pipeline « {slug} ». <Link href="/admin/pipeline" className="underline">Revenir à la liste</Link>
          </>
        }
        className="p-6"
      />
    );
  }
  // Keyed by slug: another pipeline starts from its own values.
  return <PipelineLoader key={config.slug} config={config} />;
}

// ---------------------------------------------------------------------------------------------
// List

const stageOf = (config: PipelineConfig): JourneyStage => config.stage ?? "app";

/**
 * The member's journey, stage by stage and in order, with the pipelines each one calls: whether the
 * onboarding (or any stage) uses the AI shows at a glance.
 */
function PipelineList() {
  useWarnBeforeUnload(drafts.size > 0);

  return (
    <div className="space-y-5 pb-10">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Les appels à l'IA, étape par étape du parcours d'un membre. Ouvre un pipeline pour voir ce que reçoit le modèle, dans l'ordre,
        et modifier ses prompts.
      </p>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {JOURNEY_STAGES.map((stage, index) => {
          const configs = PIPELINE_CONFIGS.filter((config) => stageOf(config) === stage.id);
          return (
            <li key={stage.id} className="flex flex-col gap-3 rounded-[18px] border border-border/70 bg-background/30 p-3">
              <div className="flex items-center gap-2.5 px-1 pt-1">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    configs.length > 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{stage.label}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{stage.paths}</p>
                </div>
              </div>
              {configs.length > 0 ? (
                configs.map((config) => <PipelineCard key={config.slug} config={config} />)
              ) : (
                <p className="flex flex-1 items-center justify-center rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Pas d'IA à cette étape
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PipelineCard({ config }: { config: PipelineConfig }) {
  const pipeline = useAiPipeline(config.slug);
  const Icon = iconOf(config.slug);
  const hasDraft = drafts.has(config.slug);

  return (
    <Link
      href={pipelinePath(config.slug)}
      className="card-3d group flex flex-col gap-3 p-3.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.06] bg-secondary">
          <Icon className="size-[18px] text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{config.label}</p>
          <p className="truncate text-xs text-muted-foreground">{config.page}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {pipeline.isPending ? (
          <Skeleton className="h-5 w-28 rounded-full" />
        ) : pipeline.data ? (
          <>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-foreground/80">{pipeline.data.model}</span>
            <span>{config.steps.length} prompts</span>
            <span aria-hidden>·</span>
            <span className="capitalize">{formatKickoff(pipeline.data.updated_at)}</span>
          </>
        ) : (
          <span className="text-destructive">Absent de la base : exécutez supabase_setup.sql</span>
        )}
      </div>
      {hasDraft && <p className="text-[11px] font-medium text-primary">Modifications non enregistrées</p>}
    </Link>
  );
}

// ---------------------------------------------------------------------------------------------
// One pipeline

function PipelineLoader({ config }: { config: PipelineConfig }) {
  const pipeline = useAiPipeline(config.slug);

  if (pipeline.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[76px] w-full rounded-[18px]" />
        <Skeleton className="h-32 w-full rounded-[18px]" />
        <Skeleton className="h-[420px] w-full rounded-[18px]" />
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
            section 7 de <code>supabase_setup.sql</code>.
          </>
        }
        className="p-6"
      />
    );
  }

  return <PipelineEditor pipeline={pipeline.data} config={config} />;
}

const scrollToStep = (slug: AiPipelineSlug, step: string) =>
  document.getElementById(sectionId(slug, step))?.scrollIntoView({ behavior: "smooth", block: "start" });

function PipelineEditor({ pipeline, config }: { pipeline: AiPipeline; config: PipelineConfig }) {
  const { toast } = useToast();
  const update = useUpdateAiPipeline(config.slug);
  const form = useForm<AiPipelineUpdate>({
    resolver: zodResolver(aiPipelineUpdateSchema),
    defaultValues: toFormValues(pipeline),
  });
  const { isDirty, dirtyFields } = form.formState;
  useWarnBeforeUnload(isDirty);

  // Edits left unsaved on a previous visit come back; leaving keeps the current ones.
  useEffect(() => {
    const draft = drafts.get(config.slug);
    if (draft) {
      for (const [name, value] of Object.entries(draft) as [keyof AiPipelineUpdate, string][]) {
        if (value !== form.getValues(name)) form.setValue(name, value, { shouldDirty: true });
      }
    }
    return () => {
      if (form.formState.isDirty) drafts.set(config.slug, form.getValues());
      else drafts.delete(config.slug);
    };
  }, [config.slug, form]);

  const onValid = async (values: AiPipelineUpdate) => {
    try {
      const saved = await update.mutateAsync(values);
      form.reset(toFormValues(saved));
      drafts.delete(config.slug);
      toast({ title: `${config.label} enregistré`, description: "Les prochains appels à l'IA utiliseront ces prompts." });
    } catch (error) {
      toast({ variant: "destructive", ...translateSupabaseError(error) });
    }
  };

  const onInvalid = (fieldErrors: FieldErrors<AiPipelineUpdate>) => {
    const firstInvalid = config.steps.find((step) => fieldErrors[step.field]);
    if (firstInvalid) scrollToStep(config.slug, firstInvalid.field);
    toast({ variant: "destructive", title: "Pipeline invalide", description: "Corrigez le prompt signalé avant d'enregistrer." });
  };

  const save = form.handleSubmit(onValid, onInvalid);

  // Ctrl+S / Cmd+S saves.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (form.formState.isDirty && !update.isPending) void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [form, update.isPending, save]);

  const discard = () => {
    form.reset(toFormValues(pipeline));
    drafts.delete(config.slug);
  };

  return (
    <Form {...form}>
      <form onSubmit={save} className="flex flex-col gap-4 pb-10">
        <header className="card-3d sticky top-0 z-20 flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate font-display text-lg font-normal">{config.label}</h2>
              <JourneyBadge stage={stageOf(config)} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {config.usedIn} · modifié le <span className="capitalize">{formatKickoff(pipeline.updated_at)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Modèle" className="h-9 w-60 gap-2 font-mono text-[13px] md:h-9">
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
            <Button type="button" variant="ghost" size="sm" onClick={discard} disabled={!isDirty || update.isPending}>
              <RotateCcw />
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={!isDirty || update.isPending} title="Ctrl+S">
              {update.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {isDirty ? "Enregistrer" : "Enregistré"}
            </Button>
          </div>
        </header>

        <Flow config={config} onGoTo={(step) => scrollToStep(config.slug, step)} />

        {config.steps.map((step, index) => (
          <PromptSection key={step.field} slug={config.slug} step={step} index={index} isDirty={Boolean(dirtyFields[step.field])}>
            <PromptEditor control={form.control} step={step} variables={config.variables} />
            {step.field === "output_format_prompt" && config.responseSchema && <EnforcedSchema schema={config.responseSchema} />}
          </PromptSection>
        ))}

        {config.fixedSteps.map((step) => (
          <FixedSection key={step.id} slug={config.slug} step={step} />
        ))}
      </form>
    </Form>
  );
}

/** The step of the member's journey a pipeline runs at, as on the list. */
function JourneyBadge({ stage }: { stage: JourneyStage }) {
  const index = JOURNEY_STAGES.findIndex((item) => item.id === stage);
  return (
    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      Étape {index + 1} · {JOURNEY_STAGES[index]?.label}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// What the model receives

/** The stages sent to the model, in order: the prompts they are made of open their section. */
function Flow({ config, onGoTo }: { config: PipelineConfig; onGoTo: (step: string) => void }) {
  const labelOf = (field: PromptFieldName) => config.steps.find((step) => step.field === field)?.label ?? field;

  return (
    <section aria-label="Ce que reçoit le modèle" className="card-3d p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ce que reçoit le modèle, dans l'ordre</p>
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {config.flow.map((stage, index) => {
          const fromApp = !stage.fields && !stage.fixedStep;
          return (
            <Fragment key={stage.label}>
              {index > 0 && (
                <li aria-hidden className="flex shrink-0 items-center justify-center text-muted-foreground/60">
                  <ArrowDown className="size-4 md:hidden" />
                  <ArrowRight className="hidden size-4 md:block" />
                </li>
              )}
              <li
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-2 rounded-[12px] border p-3",
                  fromApp ? "border-dashed border-border bg-transparent" : "border-border bg-background/40",
                )}
              >
                <div>
                  <p className="text-sm font-medium">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.detail}</p>
                </div>
                {(stage.fields || stage.fixedStep) && (
                  <div className="mt-auto flex flex-wrap gap-1">
                    {stage.fields?.map((field) => (
                      <button
                        key={field}
                        type="button"
                        onClick={() => onGoTo(field)}
                        className="rounded-[7px] border border-border bg-secondary/60 px-2 py-0.5 text-xs text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground"
                      >
                        {labelOf(field)}
                      </button>
                    ))}
                    {stage.fixedStep && (
                      <button
                        type="button"
                        onClick={() => onGoTo(stage.fixedStep!)}
                        className="inline-flex items-center gap-1 rounded-[7px] border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      >
                        <Lock className="size-3" aria-hidden /> Règles fixes
                      </button>
                    )}
                  </div>
                )}
                {fromApp && <p className="mt-auto text-[11px] text-muted-foreground/70">Géré par l'application</p>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Sections

function RoleBadge({ role }: { role: PipelineStep["role"] }) {
  return (
    <span
      title={role === "system" ? "Message système : le cadre de toute la réponse" : "Message utilisateur"}
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase",
        role === "system" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
      )}
    >
      {role}
    </span>
  );
}

type PromptSectionProps = { slug: AiPipelineSlug; step: PipelineStep; index: number; isDirty: boolean; children: ReactNode };

function PromptSection({ slug, step, index, isDirty, children }: PromptSectionProps) {
  return (
    <section id={sectionId(slug, step.field)} className="card-3d flex scroll-mt-28 flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-normal leading-7">{step.label}</h3>
            <RoleBadge role={step.role} />
            {isDirty && <span className="text-xs font-medium text-primary">Modifié</span>}
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">{step.description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** What the app adds itself: shown so the admin sees everything the models receive. */
function FixedSection({ slug, step }: { slug: AiPipelineSlug; step: FixedStep }) {
  return (
    <section
      id={sectionId(slug, step.id)}
      className="flex scroll-mt-28 flex-col gap-4 rounded-[18px] border border-dashed border-border p-4 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-normal leading-7">{step.label}</h3>
            {step.model && (
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground">{step.model}</span>
            )}
            <span className="text-xs text-muted-foreground">Fixe · lecture seule</span>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">{step.description}</p>
        </div>
      </div>
      <pre className="whitespace-pre-wrap rounded-[12px] border border-border bg-background/60 p-4 font-mono text-[13px] leading-6 text-muted-foreground">
        {step.content}
      </pre>
    </section>
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
