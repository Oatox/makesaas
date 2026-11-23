import { useState } from "react";
import { ArrowRight, Check, ChevronRight, Clock, Loader2, Lock, PartyPopper, Undo2, Zap } from "lucide-react";
import type { MissionDone, RoadmapMission, RoadmapState } from "@shared/roadmap";
import { missionCheckText, missionTime } from "@shared/roadmap-missions";
import type { Saas } from "@shared/saas";
import { dayKey, illustrationOf, type DoneTask } from "@shared/today";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { CoachMarkdown } from "@/components/coach/CoachMarkdown";
import { Button } from "@/components/ui/button";
import { useAskGus } from "@/hooks/use-ask-gus";
import { useTickMission } from "@/hooks/use-roadmap";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StepActionButton } from "./StepAction";
import { TaskBanner } from "./TaskBanner";
import { taskIcon } from "./task-icons";

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const shortDayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/**
 * One task of the day (pages/Today.tsx), as a sober card: a small icon and its state on one line
 * ("À faire maintenant", "Faite", what a locked one waits for), its title and why it matters, and
 * "Commencer" on the one to do now (outlined in orange). Done ones are dimmed. The whole card opens it
 * (TaskDetail, in the page's drawer).
 */
export function QuestTile({
  task,
  isNext,
  blocker,
  state,
  onOpen,
}: {
  task: RoadmapMission;
  /** The task to do now. */
  isNext: boolean;
  blocker: RoadmapMission | null;
  state: RoadmapState;
  onOpen: () => void;
}) {
  const done = state.done[task.key];
  const locked = !done && !!blocker;
  const current = isNext && !done && !locked;
  const time = missionTime(task);
  const Icon = done ? Check : locked ? Lock : taskIcon(task.key);

  return (
    <li className="h-full">
      {/* The whole card opens the task; its button, or the card itself, is what keyboards reach. */}
      <div
        role={current ? undefined : "button"}
        tabIndex={current ? undefined : 0}
        aria-haspopup="dialog"
        onClick={onOpen}
        onKeyDown={(event) => {
          if (!current && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          current ? "border-primary/60" : "border-border hover:border-foreground/20",
          done && "opacity-60 hover:opacity-90",
        )}
      >
        <TaskBanner illustration={illustrationOf(task)} muted={locked} className="border-b border-border" />
        <div className="flex flex-1 flex-col p-6 sm:p-7">
          <p className={cn("flex items-center gap-2 text-xs", current ? "font-medium text-primary" : "text-muted-foreground")}>
            <Icon className="h-4 w-4 shrink-0" strokeWidth={done ? 3 : 2} />
            <span className="min-w-0 truncate">
              {done
                ? done.source === "before"
                  ? "Faite avant MakeSaaS"
                  : `Faite le ${dayFormatter.format(new Date(done.at))}`
                : locked && blocker
                  ? `Après « ${blocker.title} »`
                  : current
                    ? "À faire maintenant"
                    : "Ensuite"}
            </span>
            {!done && time && <span className="ml-auto shrink-0 text-muted-foreground">{time}</span>}
          </p>

          <p className={cn("mt-5 font-medium leading-snug", locked && "text-foreground/60")}>{task.title}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{task.why}</p>

          {current && (
            <div className="mt-auto pt-7">
              <Button
                className="w-full"
                aria-haspopup="dialog"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
              >
                Commencer <ArrowRight />
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** How many tasks done the list shows before "Voir les … autres". */
const DONE_SHOWN = 5;

/**
 * The tasks already done (pages/Today.tsx, under the day's; shared/today.ts: doneTasks): a quiet list,
 * the latest first, each with its day. The first ones, then all on demand. Each opens again in the
 * drawer (TaskDetail), to read its steps and reuse their buttons (a prompt to copy again…).
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
          {all ? "Voir moins" : `Voir les ${items.length - DONE_SHOWN} autres`}
        </Button>
      )}
    </section>
  );
}

/**
 * An open task, in the page's drawer (pages/Today.tsx): its place in the day (or "Tâche accomplie" for
 * one opened from the tasks done), title, time and why, then its steps, each with its button, and
 * "C'est fait" (or what the data waits for). A launch task waits for the one before it (`blocker`,
 * "Y aller"). Done, it says when, with "Annuler" for one the member ticked (and the launch tasks ticked
 * after it, `later`, after a confirmation), and, in the day, leads to the next task.
 */
export function TaskDetail({
  task,
  place,
  blocker,
  later,
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
  later: string[];
  /** The day's next task still to do, offered once this one is done. */
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
  const done = state.done[task.key];
  const manual = task.check.kind === "manual";
  const locked = !done && !!blocker;
  const time = missionTime(task);
  const [confirming, setConfirming] = useState(false);

  const onError = () => toast({ variant: "destructive", title: "Impossible d'enregistrer", description: "Réessaie dans un instant." });
  const tickIt = () => tick.mutate({ mission: task.key, done: true }, { onError });
  const untick = () => tick.mutate({ mission: task.key, done: false, also: later }, { onError, onSettled: () => setConfirming(false) });

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {place ? `Tâche ${place.number} sur ${place.total} · Aujourd'hui` : "Tâche accomplie"}
      </p>
      <h2 className="mt-2 pr-10 font-display text-2xl font-light leading-tight sm:text-[28px]">{task.title}</h2>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {time && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/80">
            <Clock className="h-3.5 w-3.5" />
            {time}
          </span>
        )}
        {task.why}
      </p>

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
          {done && (
            <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/[0.07] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-5 w-5" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {done.source === "before" ? "Faite avant MakeSaaS" : `Faite le ${dayFormatter.format(new Date(done.at))}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{done.source === "declared" ? "Cochée par toi" : "Vue dans tes données"}</p>
                </div>
                {manual && done.source === "declared" && !confirming && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (later.length ? setConfirming(true) : untick())}
                    disabled={tick.isPending}
                  >
                    {tick.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />} Annuler
                  </Button>
                )}
              </div>
              {confirming && (
                <div className="mt-3 space-y-3 border-t border-primary/20 pt-3">
                  <p className="text-sm text-muted-foreground">
                    {later.length > 1
                      ? `Tu as coché ${later.length} tâches après celle-ci : elles seront annulées aussi.`
                      : "Tu as coché une tâche après celle-ci : elle sera annulée aussi."}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="destructive" size="sm" onClick={untick} disabled={tick.isPending}>
                      {tick.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
                      Annuler les {later.length + 1} tâches
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={tick.isPending}>
                      Garder
                    </Button>
                  </div>
                </div>
              )}
              {next ? (
                <Button className="mt-4 w-full" onClick={() => onGoTo(next.key)}>
                  Tâche suivante : {next.title} <ArrowRight />
                </Button>
              ) : (
                place && (
                  <div className="mt-4 flex flex-col items-center gap-3 pt-1 text-center">
                    <p className="inline-flex items-center gap-2 text-sm font-medium">
                      <PartyPopper className="h-4 w-4 text-primary" /> C'est tout pour aujourd'hui
                    </p>
                    <Button variant="secondary" className="w-full" onClick={onClose}>
                      Fermer
                    </Button>
                  </div>
                )
              )}
            </div>
          )}

          <p className="mt-7 text-xs font-semibold text-muted-foreground">{done ? "Ce que tu as fait" : "Comment faire"}</p>
          <ol className="mt-3">
            {task.steps.map((step, index) => (
              <li key={index} className="relative flex gap-3.5 pb-6 last:pb-0">
                {/* The line down to the next step. */}
                {index < task.steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[13px] top-8 w-px bg-border" />}
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-3 pt-0.5">
                  <CoachMarkdown text={step.text} className="text-sm leading-6" />
                  {step.action && <StepActionButton action={step.action} saas={saas} state={state} />}
                </div>
              </li>
            ))}
          </ol>

          {!done && (
            <div className="mt-8 space-y-4 border-t border-border pt-5">
              {manual ? (
                <Button onClick={tickIt} disabled={tick.isPending} className="w-full">
                  {tick.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                  C'est fait
                </Button>
              ) : (
                <p className="flex items-center gap-2 rounded-xl bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 shrink-0 text-primary" />
                  {missionCheckText(task.check)}
                </p>
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
