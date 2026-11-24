import { Check, ChevronRight, Lock, Plus } from "lucide-react";
import type { RoadmapMission, RoadmapStage, RoadmapState } from "@shared/roadmap";
import { missionTime } from "@shared/roadmap-missions";
import { taskBlocker } from "@shared/today";
import { cn } from "@/lib/utils";

/**
 * The day's tasks as one list (pages/Today.tsx), like a setup guide: a row per task with its state
 * (done, locked, to do; the one to do now outlined in orange), its title and its time; a locked one
 * says what it waits for. A row opens its task in the page's drawer (TaskDetail). "Demander de
 * nouvelles tâches" closes the list once every task is done.
 */
export function DayTaskList({
  tasks,
  stages,
  state,
  nextTask,
  onOpen,
  onMore,
}: {
  tasks: RoadmapMission[];
  stages: RoadmapStage[];
  state: RoadmapState;
  /** The task to do now. */
  nextTask: RoadmapMission | null;
  onOpen: (key: string) => void;
  /** Gives new tasks (the done ones leave the list); absent while some are left, or none is left to give. */
  onMore?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
      <ol className="divide-y divide-border">
        {tasks.map((task) => {
          const done = state.done[task.key];
          const blocker = taskBlocker(stages, state.done, task.key);
          const locked = !done && !!blocker;
          const current = task === nextTask;
          const time = missionTime(task);

          return (
            <li key={task.key}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => onOpen(task.key)}
                className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none sm:px-6"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    done
                      ? "bg-primary text-primary-foreground"
                      : locked
                        ? "border border-border text-muted-foreground"
                        : current
                          ? "border-[1.5px] border-dashed border-primary"
                          : "border-[1.5px] border-dashed border-muted-foreground/40",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : locked ? <Lock className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-medium leading-snug", (done || locked) && "text-muted-foreground")}>{task.title}</span>
                  {locked && blocker && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">Après « {blocker.title} »</span>
                  )}
                </span>
                {!done && time && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{time}</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}

        {onMore && (
          <li>
            <button
              type="button"
              onClick={onMore}
              className="flex w-full items-center gap-3.5 px-5 py-4 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground focus-visible:bg-secondary/40 focus-visible:outline-none sm:px-6"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
                <Plus className="h-3.5 w-3.5" />
              </span>
              Demander de nouvelles tâches
            </button>
          </li>
        )}
      </ol>
    </div>
  );
}
