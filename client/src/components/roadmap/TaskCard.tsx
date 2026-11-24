import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock, Loader2, Lock, PartyPopper, Undo2, Zap } from "lucide-react";
import type { MissionDone, RoadmapMission, RoadmapState } from "@shared/roadmap";
import { missionCheckText, missionTime } from "@shared/roadmap-missions";
import type { Saas } from "@shared/saas";
import { dayKey, type DoneTask } from "@shared/today";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { CoachMarkdown } from "@/components/coach/CoachMarkdown";
import { Button } from "@/components/ui/button";
import { useAskGus } from "@/hooks/use-ask-gus";
import { useTickMission } from "@/hooks/use-roadmap";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StepActionButton } from "./StepAction";

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const shortDayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** A step slides in from the side it comes from: `direction` 1 forward, -1 back. */
const stepMotion = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 16 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -16 }),
};

/** How many tasks done the list shows before "Voir … autres". */
const DONE_SHOWN = 3;

/**
 * Buttons that complete their task right there (its logo dropped, its payment account, its app's
 * address, its TikTok account, its payment link): on its last step, the task's "Se coche dès que…"
 * would only repeat them.
 */
const COMPLETING_ACTIONS = new Set(["settings", "payment_account", "app_url", "tiktok_account", "payment_link"]);

/**
 * The tasks already done (pages/Today.tsx, under the day's; shared/today.ts: doneTasks): a quiet list,
 * in the order of the journey, the furthest first, each with its day. The first ones, then all on
 * demand. Each opens again in the drawer (TaskDetail), to read its steps and reuse their buttons (a
 * prompt to copy again…).
 */
export function DoneTaskList({ items, onOpen }: { items: DoneTask[]; onOpen: (key: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, DONE_SHOWN);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const when = (done: MissionDone) => {
    if (done.source === "before") return "Avant MakeSaaS";
    const day = dayKey(new Date(done.at));
    return day === today ? "Aujourd'hui" : day === yesterday ? "Hier" : shortDayFormatter.format(new Date(done.at));
  };

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-light leading-none sm:text-xl">Tâches accomplies</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-border">
        {shown.map(({ task, done }) => (
          <li key={task.key} className="border-b border-border last:border-b-0">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => onOpen(task.key)}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none sm:px-5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{when(done)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      {items.length > DONE_SHOWN && (
        <Button variant="ghost" className="w-full" onClick={() => setAll((value) => !value)}>
          {all ? "Voir moins" : `Voir ${items.length - DONE_SHOWN} autre${items.length - DONE_SHOWN > 1 ? "s" : ""}`}
        </Button>
      )}
    </section>
  );
}

/**
 * An open task, in the page's drawer (pages/Today.tsx): its place in the day (or "Tâche accomplie" for
 * one opened from the tasks done) and time, its title, why it matters in Gus's words, then its
 * instructions (its `steps`) one at a time, numbered and with no other name (a segment per instruction
 * to go back to it), each with its button and "Suivant"; on the last one,
 * "Tâche suivante", which ticks it and opens the day's next task ("C'est fait" for the day's last;
 * what the data waits for when it checks it). A launch task waits for the one before it (`blocker`,
 * "Y aller"). Done, it says when, with "Pas encore faite" for one the member ticked (that one only: the
 * tasks ticked after it stay done), all its steps at once, and, in the day, leads to the next task.
 */
export function TaskDetail({
  task,
  place,
  blocker,
  next,
  onGoTo,
  onClose,
  saas,
  state,
}: {
  task: RoadmapMission;
  /** Its place in the day's tasks; null for one opened from the tasks done. */
  place: { number: number; total: number } | null;
  blocker: RoadmapMission | null;
  /** The day's task to do after this one: "Tâche suivante" ticks this one and opens it; offered again once this one is done. */
  next: RoadmapMission | null;
  /** Opens another task (the one to finish first, the next one). */
  onGoTo: (key: string) => void;
  onClose: () => void;
  saas: Saas;
  state: RoadmapState;
}) {
  const { toast } = useToast();
  const askGus = useAskGus();
  const tick = useTickMission(saas.id);
  // Ticked on the way to the next task: shown as still to do until it opens.
  const [advancing, setAdvancing] = useState(false);
  const done = advancing ? undefined : state.done[task.key];
  const manual = task.check.kind === "manual";
  const locked = !done && !!blocker;
  const time = missionTime(task);
  // The step shown, and the side it came from.
  const [[stepIndex, direction], setStep] = useState<[number, number]>([0, 1]);
  const steps = task.steps;
  const step = steps[stepIndex];
  const lastStep = stepIndex >= steps.length - 1;
  // A task checked from the data whose last step's own button completes it (a field, a drop zone): it
  // waits for that button, so nothing is added under it (it gets done, and the drawer moves on).
  const waitsHere = !manual && lastStep && !!step?.action && COMPLETING_ACTIONS.has(step.action.kind);
  const stepsTop = useRef<HTMLDivElement>(null);
  const goToStep = (index: number) => setStep([index, index > stepIndex ? 1 : -1]);

  // A new instruction: its segments back in view, should the member have scrolled down to its buttons.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    stepsTop.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [stepIndex]);

  const onError = () => toast({ variant: "destructive", title: "Impossible d'enregistrer", description: "Réessaie dans un instant." });
  // Ticked (optimistically), then on to the day's next task once saved.
  const tickIt = () => {
    if (next) setAdvancing(true);
    tick.mutate(
      { mission: task.key, done: true },
      {
        onError: () => {
          setAdvancing(false);
          onError();
        },
        onSuccess: () => next && onGoTo(next.key),
      },
    );
  };
  const untick = () => tick.mutate({ mission: task.key, done: false }, { onError });
  const busy = tick.isPending || advancing;

  return (
    <section>
      {/* Where the task stands in the day and how long it takes (when it was done, once done), on one
          quiet line above its title. */}
      <p className="flex items-center gap-2 pr-20 text-sm text-muted-foreground">
        {place && <span>{`Tâche ${place.number} sur ${place.total}`}</span>}
        {done ? (
          <>
            {place && <span aria-hidden className="h-1 w-1 rounded-full bg-muted-foreground/50" />}
            <span className="inline-flex items-center gap-1.5 font-medium text-primary">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              {done.source === "before" ? "Faite avant MakeSaaS" : `Faite le ${dayFormatter.format(new Date(done.at))}`}
            </span>
          </>
        ) : (
          time && (
            <>
              {place && <span aria-hidden className="h-1 w-1 rounded-full bg-muted-foreground/50" />}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {time}
              </span>
            </>
          )
        )}
      </p>
      <h2 className="mt-2 pr-20 font-display text-[26px] font-light leading-tight sm:text-3xl">{task.title}</h2>
      {/* Why it matters, in Gus's words. */}
      <div className="mt-4 flex items-start gap-3">
        <CoachAvatar className="h-7 w-7 shrink-0" />
        <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{task.why}</p>
      </div>

      {locked && blocker ? (
        <div className="mt-6 rounded-2xl bg-secondary/50 px-5 py-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <p className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground">
            Termine d'abord <span className="font-medium text-foreground">«&nbsp;{blocker.title}&nbsp;»</span> pour débloquer cette tâche.
          </p>
          <Button variant="secondary" className="mt-5" onClick={() => onGoTo(blocker.key)}>
            Y aller <ArrowRight />
          </Button>
        </div>
      ) : (
        <>
          {done ? (
            <>
              {/* What was done, to read again and reuse its buttons; "Annuler" stays discreet. */}
              <div className="mt-7 flex min-h-8 items-center justify-between gap-3">
                <p className="text-xs font-semibold text-muted-foreground">Ce que tu as fait</p>
                {manual && done.source === "declared" ? (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={untick} disabled={tick.isPending}>
                    {tick.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />} Pas encore faite
                  </Button>
                ) : (
                  done.source !== "before" && <span className="text-xs text-muted-foreground">Vue dans tes données</span>
                )}
              </div>
              <ol className="mt-3">
                {steps.map((item, index) => (
                  <li key={index} className="relative flex gap-3.5 pb-6 last:pb-0">
                    {/* The line down to the next instruction. */}
                    {index < steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[13px] top-8 w-px bg-border" />}
                    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-3 pt-0.5">
                      <CoachMarkdown text={item.text} className="text-sm leading-6 text-foreground/85" />
                      {item.action && <StepActionButton action={item.action} saas={saas} state={state} quiet />}
                    </div>
                  </li>
                ))}
              </ol>

              {/* Then on: the next task, where the task in progress has its main button; pinned to the
                  bottom of the drawer while a long recap scrolls under it (its solid shadow hides the
                  recap in the drawer's bottom padding, which the pinning leaves below it). */}
              {(next || place) && (
                <div className="sticky bottom-0 z-10 mt-8 border-t border-border bg-card pb-1 pt-5 shadow-[0_48px_0_0_hsl(var(--card))]">
                  {next ? (
                    <Button className="w-full" onClick={() => onGoTo(next.key)}>
                      <span className="min-w-0 truncate">Tâche suivante : {next.title}</span>
                      <ArrowRight />
                    </Button>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <p className="inline-flex items-center gap-2 text-sm font-medium">
                        <PartyPopper className="h-4 w-4 text-primary" /> C'est tout pour aujourd'hui
                      </p>
                      <Button variant="secondary" className="w-full" onClick={onClose}>
                        Fermer
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            step && (
              <div ref={stepsTop} className="mt-7 scroll-mt-6">
                {/* A segment per instruction: the ones seen in orange; each goes back to its instruction. */}
                <div className="-my-2 flex gap-1.5">
                  {steps.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Consigne ${index + 1} sur ${steps.length}`}
                      aria-current={index === stepIndex ? "step" : undefined}
                      onClick={() => goToStep(index)}
                      className="group flex-1 py-2 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "block h-1.5 rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary/60",
                          index <= stepIndex ? "bg-primary" : "bg-secondary group-hover:bg-foreground/20",
                        )}
                      />
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <motion.div
                    key={stepIndex}
                    custom={direction}
                    variants={stepMotion}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="mt-4 space-y-4"
                  >
                    {/* The instruction by its number; its button under both, the full width. */}
                    <div className="flex gap-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                        {stepIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <CoachMarkdown text={step.text} className="text-[15px] leading-6" />
                      </div>
                    </div>
                    {step.action && <StepActionButton action={step.action} saas={saas} state={state} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            )
          )}

          {!done && (
            <div className="mt-8 space-y-4 border-t border-border pt-5">
              {(stepIndex > 0 || !waitsHere) && (
                <div className="flex gap-2">
                  {stepIndex > 0 && (
                    <Button variant="secondary" onClick={() => goToStep(stepIndex - 1)} disabled={busy}>
                      <ArrowLeft /> Retour
                    </Button>
                  )}
                  {!lastStep ? (
                    // Quieter when the step has its own button: that one comes first.
                    <Button variant={step?.action ? "secondary" : "default"} className="flex-1" onClick={() => goToStep(stepIndex + 1)}>
                      Suivant <ArrowRight />
                    </Button>
                  ) : manual ? (
                    next ? (
                      <Button onClick={tickIt} disabled={busy} className="flex-1">
                        Tâche suivante
                        {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                      </Button>
                    ) : (
                      <Button onClick={tickIt} disabled={busy} className="flex-1">
                        {busy ? <Loader2 className="animate-spin" /> : <Check />}
                        C'est fait
                      </Button>
                    )
                  ) : (
                    !waitsHere && (
                      <p className="flex flex-1 items-center gap-2 rounded-xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                        <Zap className="h-4 w-4 shrink-0 text-primary" />
                        {missionCheckText(task.check)}
                      </p>
                    )
                  )}
                </div>
              )}
              <div className="flex">
                <button
                  type="button"
                  onClick={() => askGus(saas.id, `Je suis sur la tâche « ${task.title} » de ma journée. Aide-moi à la faire, pas à pas.`)}
                  className="mx-auto flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  <CoachAvatar className="h-6 w-6" /> Bloqué ? <span className="font-medium text-primary">Demande à {COACH_NAME}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
