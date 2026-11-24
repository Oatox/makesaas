import { Check } from "lucide-react";
import type { MissionDone, RoadmapState } from "@shared/roadmap";
import { milestonesFor, roadmapStagesFor } from "@shared/roadmap-missions";
import {
  currentObjective,
  dayKey,
  doneTasks,
  launchTasks,
  milestoneCounter,
  objectiveProgress,
  objectivesOf,
  todayPlan,
  type Objective,
} from "@shared/today";
import { formatAgoShort, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Where a SaaS stands on its member's journey, read from the same roadmap as their Accueil and
 * Roadmap pages (shared/today.ts): its milestones (objectives), the one in progress, the next task
 * and the tasks done. Read only.
 */
export function saasProgress(roadmap: RoadmapState) {
  const stages = roadmapStagesFor(roadmap.goal);
  const objectives = objectivesOf(milestonesFor(roadmap.goal));
  const current = currentObjective(objectives, roadmap.done);
  const plan = todayPlan(stages, roadmap.done, dayKey(new Date()));
  const launch = launchTasks(stages);
  const records = Object.values(roadmap.done).filter((record) => record.source !== "before");

  return {
    objectives,
    current,
    currentIndex: current ? objectives.indexOf(current) : objectives.length - 1,
    phase: plan.phase,
    launchDone: launch.filter((task) => roadmap.done[task.key]).length,
    launchTotal: launch.length,
    nextTask: plan.tasks.find((task) => !roadmap.done[task.key]) ?? null,
    lastProgressAt: records.reduce<string | null>((latest, record) => (!latest || record.at > latest ? record.at : latest), null),
    tasksDone: doneTasks(stages, roadmap.done),
  };
}

/** When a milestone or task was reached: "12 nov. 2026", or "Avant MakeSaaS". */
const reachedLabel = (record: MissionDone | null) =>
  !record || record.source === "before" ? "Avant MakeSaaS" : formatShortDate(record.at);

/** The objectives as one bar: a segment each, full once reached, the one in progress filled by its share. */
export function ObjectivesBar({ objectives, roadmap }: { objectives: Objective[]; roadmap: RoadmapState }) {
  return (
    <div className="flex gap-1">
      {objectives.map((objective) => {
        const progress = objectiveProgress(objective, roadmap.done, roadmap.progress);
        return (
          <span key={objective.key} title={objective.title} className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress.complete ? 100 : progress.share * 100}%` }}
            />
          </span>
        );
      })}
    </div>
  );
}

function StatusMark({ state }: { state: "done" | "current" | "upcoming" }) {
  if (state === "done") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
        state === "current" ? "border-primary" : "border-border",
      )}
    >
      {state === "current" && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}

/** Every milestone (objective) of the journey, the one in progress opened on its steps. */
export function MilestoneList({ objectives, current, roadmap }: { objectives: Objective[]; current: Objective | null; roadmap: RoadmapState }) {
  return (
    <ol className="space-y-0.5">
      {objectives.map((objective) => {
        const progress = objectiveProgress(objective, roadmap.done, roadmap.progress);
        const isCurrent = objective === current;
        const status = progress.complete
          ? reachedLabel(progress.reachedAt)
          : isCurrent
            ? progress.total === 1 && progress.counter
              ? progress.counter.label
              : `${progress.reached} / ${progress.total} étapes`
            : null;

        return (
          <li key={objective.key}>
            <div className={cn("flex items-center gap-3 rounded-lg px-2.5 py-2", isCurrent && "bg-primary/[0.07]")}>
              <StatusMark state={progress.complete ? "done" : isCurrent ? "current" : "upcoming"} />
              <span className={cn("min-w-0 flex-1 truncate text-sm", progress.complete || isCurrent ? "font-medium" : "text-muted-foreground")}>
                {objective.title}
              </span>
              {status && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{status}</span>}
            </div>

            {isCurrent && objective.milestones.length > 1 && (
              <ul className="mb-1 ml-[19px] space-y-1.5 border-l border-border py-1.5 pl-5">
                {objective.milestones.map((milestone) => {
                  const record = roadmap.done[milestone.key];
                  const counter = !record && milestone === progress.current ? milestoneCounter(milestone, roadmap.progress) : null;
                  return (
                    <li key={milestone.key} className="flex items-center gap-2.5 text-[13px]">
                      {record ? (
                        <Check className="size-3.5 shrink-0 text-primary" strokeWidth={3} />
                      ) : (
                        <span className={cn("mx-[3px] size-2 shrink-0 rounded-full", milestone === progress.current ? "bg-primary" : "bg-border")} />
                      )}
                      <span className={cn("min-w-0 flex-1 truncate", !record && milestone !== progress.current && "text-muted-foreground")}>
                        {milestone.title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {record ? reachedLabel(record) : (counter?.label ?? (milestone === progress.current ? "En cours" : ""))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const SOURCE_LABELS: Record<MissionDone["source"], string> = {
  declared: "Cochée",
  observed: "Vue dans ses données",
  before: "Avant MakeSaaS",
};

const TASKS_SHOWN = 6;

/** The tasks done, the latest first, with how each was done. */
export function DoneTaskList({ tasks }: { tasks: ReturnType<typeof saasProgress>["tasksDone"] }) {
  if (!tasks.length) {
    return <p className="px-2.5 py-2 text-sm text-muted-foreground">Aucune tâche faite pour l'instant.</p>;
  }
  return (
    <>
      <ul className="space-y-0.5">
        {tasks.slice(0, TASKS_SHOWN).map(({ task, done }) => (
          <li key={task.key} className="flex items-center gap-3 rounded-lg px-2.5 py-2">
            <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{task.title}</p>
              <p className="text-xs text-muted-foreground">{SOURCE_LABELS[done.source]}</p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {done.source === "before" ? "" : formatAgoShort(done.at)}
            </span>
          </li>
        ))}
      </ul>
      {tasks.length > TASKS_SHOWN && (
        <p className="px-2.5 pt-1 text-xs text-muted-foreground">
          + {tasks.length - TASKS_SHOWN} autre{tasks.length - TASKS_SHOWN > 1 ? "s" : ""}
        </p>
      )}
    </>
  );
}
