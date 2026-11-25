import { useId, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarCheck, Check, ChevronDown, Lock, type LucideIcon } from "lucide-react";
import type { Milestone, MissionDone, RoadmapMission, RoadmapStage, RoadmapState } from "@shared/roadmap";
import { missionTime } from "@shared/roadmap-missions";
import { milestoneCounter, milestoneShare, milestoneTasks, objectiveProgress, type Objective } from "@shared/today";
import type { Saas } from "@shared/saas";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { Button } from "@/components/ui/button";
import { useAskGus } from "@/hooks/use-ask-gus";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

const fullDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const longDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** When a task was done, in its row: its day, or before MakeSaaS. */
const whenDone = (record: MissionDone) => (record.source === "before" ? "Avant MakeSaaS" : shortDay.format(new Date(record.at)));

/**
 * An objective of the Roadmap, in its drawer (pages/Roadmap.tsx), like its node on the path: its icon,
 * its place ("Objectif 2 sur 7", or "Objectif final"), its title and what it means. Then where the
 * member stands: reached and when; in progress, its steps as segments (no card), each filled by its figure or
 * its tasks done (milestoneShare); or the objective it comes after. Then its
 * steps, each with its date, figure or tasks done, unfolding the tasks that lead to it (milestoneTasks:
 * the one in progress unfolded), or, for an objective of a single step (an amount per month), those
 * tasks right away. At the bottom, always in view, the way to Accueil's tasks and to Gus.
 */
export function ObjectiveDetail({
  objective,
  index,
  objectives,
  milestones,
  stages,
  isCurrent,
  icon: Icon,
  state,
  saas,
}: {
  objective: Objective;
  index: number;
  objectives: Objective[];
  milestones: Milestone[];
  stages: RoadmapStage[];
  isCurrent: boolean;
  /** Its node's icon on the path. */
  icon: LucideIcon;
  state: RoadmapState;
  saas: Saas;
}) {
  const askGus = useAskGus();
  const progress = objectiveProgress(objective, state.done, state.progress);
  const previous = index > 0 ? objectives[index - 1] : null;
  const isLast = index === objectives.length - 1;
  const single = objective.milestones.length === 1 ? objective.milestones[0] : null;
  const growth = objective.milestones.some((milestone) => milestone.phase === "growth");
  const tasksOf = (milestone: Milestone) => milestoneTasks(stages, milestones, milestone.key);
  const shareOf = (milestone: Milestone) => milestoneShare(stages, milestones, milestone, state.done, state.progress);
  const allTasks = objective.milestones.flatMap(tasksOf);
  const tasksDone = allTasks.filter((task) => state.done[task.key]).length;
  // The task to do now: the first one left in the steps not passed yet (in progress only).
  const nextTask =
    isCurrent && !progress.complete
      ? (objective.milestones
          .filter((milestone) => !state.done[milestone.key])
          .flatMap(tasksOf)
          .find((task) => !state.done[task.key]) ?? null)
      : null;
  // The steps unfolded: the one in progress, at first.
  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set(isCurrent && progress.current ? [progress.current.key] : []));
  const toggle = (key: string) =>
    setUnfolded((keys) => {
      const next = new Set(keys);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const singleTasks = single ? tasksOf(single) : [];
  const singleFigure = single
    ? (progress.counter?.label ?? (singleTasks.length ? `${tasksDone} / ${singleTasks.length} tâche${singleTasks.length > 1 ? "s" : ""}` : null))
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-7 pt-6 sm:px-7 sm:pt-7">
        {/* Like its node on the path. */}
        <ObjectiveIcon icon={Icon} complete={progress.complete} current={isCurrent} goal={isLast} />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isLast ? "Objectif final" : `Objectif ${index + 1} sur ${objectives.length}`}
        </p>
        <h2 className="mt-1 pr-10 font-display text-[26px] font-light leading-tight sm:text-3xl">{objective.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{objective.detail}</p>

        {/* Where the member stands. */}
        {progress.complete ? (
          <div className="mt-6 flex items-center gap-3.5 rounded-2xl border border-primary/25 bg-primary/[0.07] p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-5 w-5" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Objectif atteint</p>
              <p className="text-sm text-muted-foreground">
                {progress.reachedAt?.source === "before" || !progress.reachedAt
                  ? "Avant MakeSaaS"
                  : `Le ${fullDay.format(new Date(progress.reachedAt.at))}, vu dans tes données`}
              </p>
            </div>
          </div>
        ) : isCurrent ? (
          // In progress, right on the drawer (no card): its label, its count, its steps as segments.
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
                <span aria-hidden className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                En cours · Tu es ici
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {single ? singleFigure : `${progress.reached} / ${progress.total} étape${progress.total > 1 ? "s" : ""}`}
              </span>
            </div>
            <div className="mt-3 flex gap-1.5">
              {objective.milestones.map((milestone, stepIndex) => (
                <ShareBar key={milestone.key} share={shareOf(milestone)} delay={0.15 + stepIndex * 0.08} label={milestone.title} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Lock className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">À venir</p>
              {previous && (
                <p className="text-sm text-muted-foreground">
                  Après <span className="text-foreground">«&nbsp;{previous.title}&nbsp;»</span>
                  {allTasks.length > 0 && ` · ${allTasks.length} tâche${allTasks.length > 1 ? "s" : ""}`}
                </p>
              )}
            </div>
          </div>
        )}

        {single ? (
          // A single step (an amount per month): the tasks that lead to it.
          singleTasks.length > 0 && (
            <>
              <SectionTitle title="Les tâches pour y arriver" count={`${tasksDone} / ${singleTasks.length}`} />
              <div className="mt-2.5 overflow-hidden rounded-2xl border border-border bg-card">
                <TaskRows tasks={singleTasks} done={state.done} next={nextTask} />
              </div>
            </>
          )
        ) : (
          <>
            <SectionTitle title="Ses étapes" count={allTasks.length ? `${tasksDone} / ${allTasks.length} tâche${allTasks.length > 1 ? "s" : ""}` : null} />
            <ol className="mt-2.5 space-y-2">
              {objective.milestones.map((milestone, stepIndex) => (
                <StepCard
                  key={milestone.key}
                  milestone={milestone}
                  number={stepIndex + 1}
                  done={state.done[milestone.key]}
                  current={isCurrent && milestone === progress.current}
                  tasks={tasksOf(milestone)}
                  state={state}
                  next={nextTask}
                  open={unfolded.has(milestone.key)}
                  onToggle={() => toggle(milestone.key)}
                />
              ))}
            </ol>
          </>
        )}

        {!progress.complete && growth && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-secondary/40 p-3.5 text-sm leading-relaxed text-muted-foreground">
            <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Chaque jour sur ton Accueil, tes tâches : poster une vidéo et répondre aux commentaires. C'est ce qui te rapproche de cet objectif.</p>
          </div>
        )}
      </div>

      {/* Always in view: what to do now. */}
      {!progress.complete && (
        <div className="shrink-0 border-t border-border bg-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-5">
          <Button asChild className="w-full">
            <Link href="/accueil">
              Mes tâches du jour <ArrowRight />
            </Link>
          </Button>
          <div className="mt-2.5 flex">
            <button
              type="button"
              onClick={() => askGus(saas.id, `Je vise l'objectif « ${objective.title} » de ma roadmap. Comment je l'atteins le plus vite, pour mon projet ?`)}
              className="mx-auto flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <CoachAvatar className="h-6 w-6" /> Comment l'atteindre ? <span className="font-medium text-primary">Demande à {COACH_NAME}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The objective's icon, drawn like its node on the path (RoadmapPath, the same 3D face): orange once
 * reached (ticked, the goal keeping its own), ringed in orange in progress, dashed for the goal to come.
 */
function ObjectiveIcon({ icon, complete, current, goal }: { icon: LucideIcon; complete: boolean; current: boolean; goal: boolean }) {
  const Icon = complete && !goal ? Check : icon;
  return (
    <span aria-hidden className="relative inline-flex">
      {current && <span className="absolute -inset-[5px] rounded-full border-2 border-primary" />}
      {goal && !complete && !current && <span className="absolute -inset-[6px] rounded-full border-2 border-dashed border-primary/45" />}
      <span
        className={cn(
          "btn-3d pointer-events-none flex h-14 w-14 items-center justify-center rounded-full",
          complete ? "btn-3d-primary text-primary-foreground" : cn("btn-3d-secondary", current || goal ? "text-primary" : "text-muted-foreground/70"),
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={complete ? 3 : 2} />
      </span>
    </span>
  );
}

/** A segment of the objective's bar: one step, filled by how far it is (flat, like Accueil's ObjectiveBar). */
function ShareBar({ share, delay, label }: { share: number; delay: number; label: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <span title={label} className="block h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
      {share > 0 && (
        <motion.span
          className="block h-full rounded-full bg-primary"
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${share * 100}%` }}
          transition={{ duration: 0.6, delay, ease: EASE_OUT }}
        />
      )}
    </span>
  );
}

function SectionTitle({ title, count }: { title: string; count: string | null }) {
  return (
    <div className="mt-7 flex items-baseline justify-between gap-3 px-1">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {count && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </div>
  );
}

/**
 * A step of the objective, as a card: its mark, title, and date once passed (else its figure or what it
 * means), with its tasks done; it unfolds the tasks that lead to it. The one in progress is outlined in
 * orange.
 */
function StepCard({
  milestone,
  number,
  done,
  current,
  tasks,
  state,
  next,
  open,
  onToggle,
}: {
  milestone: Milestone;
  number: number;
  done: MissionDone | undefined;
  current: boolean;
  tasks: RoadmapMission[];
  state: RoadmapState;
  next: RoadmapMission | null;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const counter = done ? null : milestoneCounter(milestone, state.progress);
  const tasksDone = tasks.filter((task) => state.done[task.key]).length;
  const foldable = tasks.length > 0;
  const subtitle = done
    ? done.source === "before"
      ? "Avant MakeSaaS"
      : `Passée le ${longDay.format(new Date(done.at))}`
    : counter && counter.target > 1
      ? counter.label
      : milestone.detail;

  const header = (
    <>
      <StepMark done={!!done} current={current} number={number} />
      <span className="min-w-0 flex-1">
        <span className={cn("block font-medium leading-snug", done && "text-muted-foreground")}>{milestone.title}</span>
        <span className={cn("mt-0.5 block text-xs", current && counter && counter.target > 1 ? "text-foreground/80" : "text-muted-foreground")}>
          {subtitle}
        </span>
      </span>
      {foldable && !done && (
        <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">
          {tasksDone} / {tasks.length} tâche{tasks.length > 1 ? "s" : ""}
        </span>
      )}
      {foldable && (
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      )}
    </>
  );

  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors",
        current ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card",
      )}
    >
      {foldable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/30 focus-visible:bg-secondary/30 focus-visible:outline-none"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3.5">{header}</div>
      )}
      <AnimatePresence initial={false}>
        {foldable && open && (
          <motion.div
            id={panelId}
            key="tasks"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/70">
              <TaskRows tasks={tasks} done={state.done} next={next} inset />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** The tasks of a step: done with their day, the next one outlined in orange, the others with their time. */
function TaskRows({
  tasks,
  done,
  next,
  inset = false,
}: {
  tasks: RoadmapMission[];
  done: Record<string, MissionDone>;
  next: RoadmapMission | null;
  /** Under a step's title (in its card), rather than on their own. */
  inset?: boolean;
}) {
  return (
    <ul className="divide-y divide-border/60">
      {tasks.map((task) => {
        const record = done[task.key];
        const isNext = !record && task.key === next?.key;
        const time = missionTime(task);
        return (
          <li
            key={task.key}
            className={cn("flex items-center gap-3 py-2.5 pr-4", inset ? "pl-14" : "pl-4", isNext && "bg-primary/[0.06]")}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                record
                  ? "bg-primary/90 text-primary-foreground"
                  : isNext
                    ? "border-[1.5px] border-dashed border-primary"
                    : "border-[1.5px] border-dashed border-muted-foreground/40",
              )}
            >
              {record && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className={cn("min-w-0 flex-1 text-sm leading-snug", record ? "text-muted-foreground" : isNext ? "font-medium" : "text-foreground/85")}>
              <span className="sr-only">{record ? "Faite : " : isNext ? "À faire maintenant : " : "À faire : "}</span>
              {task.title}
            </span>
            {(record || time) && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{record ? whenDone(record) : time}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A step's mark: ticked once passed, its number otherwise (outlined in orange in progress). */
function StepMark({ done, current, number }: { done: boolean; current: boolean; number: number }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        done ? "bg-primary text-primary-foreground" : current ? "border-2 border-primary text-primary" : "border border-border text-muted-foreground",
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : number}
    </span>
  );
}
