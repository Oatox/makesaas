import { Link } from "wouter";
import { ArrowRight, CalendarCheck, Check, Lock } from "lucide-react";
import type { Milestone, RoadmapStage, RoadmapState } from "@shared/roadmap";
import { milestoneCounter, milestoneTasks, objectiveProgress, type Objective } from "@shared/today";
import type { Saas } from "@shared/saas";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { Button } from "@/components/ui/button";
import { useAskGus } from "@/hooks/use-ask-gus";
import { cn } from "@/lib/utils";

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * A milestone of the Roadmap (an objective of Accueil), in its drawer (pages/Roadmap.tsx): where the
 * member stands (reached and when, its steps when in progress, or what comes before it), then its
 * steps, each with where it stands (when reached, its figure, the tasks that lead to it), and the way
 * to Accueil's tasks and to Gus.
 */
export function ObjectiveDetail({
  objective,
  index,
  objectives,
  milestones,
  stages,
  isCurrent,
  state,
  saas,
}: {
  objective: Objective;
  index: number;
  objectives: Objective[];
  milestones: Milestone[];
  stages: RoadmapStage[];
  isCurrent: boolean;
  state: RoadmapState;
  saas: Saas;
}) {
  const askGus = useAskGus();
  const progress = objectiveProgress(objective, state.done, state.progress);
  const previous = index > 0 ? objectives[index - 1] : null;
  const isGoal = index === objectives.length - 1;
  const growth = objective.key !== "launch";

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {isGoal ? "Ton objectif" : `Palier ${index + 1} sur ${objectives.length}`}
      </p>
      <h2 className="mt-2 pr-10 font-display text-2xl font-light leading-tight sm:text-[28px]">{objective.title}</h2>

      {/* Where the member stands. */}
      {progress.complete ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] py-3 pl-3 pr-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {progress.reachedAt?.source === "before" || !progress.reachedAt
                ? "Atteint avant MakeSaaS"
                : `Atteint le ${dayFormatter.format(new Date(progress.reachedAt.at))}`}
            </p>
            <p className="text-xs text-muted-foreground">Vu dans tes données</p>
          </div>
        </div>
      ) : isCurrent ? (
        <div className="mt-5 rounded-xl border border-primary/40 bg-primary/[0.05] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold text-primary">En cours · Tu es ici</p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {progress.total === 1 && progress.counter ? progress.counter.label : `${progress.reached} / ${progress.total} étapes`}
            </p>
          </div>
          <span className="mt-3 block h-2 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress.share * 100}%` }} />
          </span>
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-secondary/50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="h-4 w-4 text-muted-foreground" /> À venir
          </p>
          {previous && (
            <p className="mt-1 text-sm text-muted-foreground">
              Il vient après <span className="font-medium text-foreground">«&nbsp;{previous.title}&nbsp;»</span>.
            </p>
          )}
        </div>
      )}

      {/* Its steps. */}
      <p className="mt-6 px-1 text-xs font-semibold text-muted-foreground">Ses étapes</p>
      <ul className="mt-2 overflow-hidden rounded-2xl border border-border">
        {objective.milestones.map((milestone, stepIndex) => {
          const done = state.done[milestone.key];
          const isStepCurrent = milestone === progress.current;
          const counter = isStepCurrent ? milestoneCounter(milestone, state.progress) : null;
          const tasks = milestoneTasks(stages, milestones, milestone.key);
          const tasksDone = tasks.filter((task) => state.done[task.key]).length;
          return (
            <li key={milestone.key} className="flex items-start gap-3 border-b border-border px-3.5 py-3 last:border-b-0">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  done
                    ? "bg-primary text-primary-foreground"
                    : isStepCurrent
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : stepIndex + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", done && "text-muted-foreground")}>{milestone.title}</p>
                <p className="text-xs text-muted-foreground">
                  {done
                    ? done.source === "before"
                      ? "Avant MakeSaaS"
                      : `Atteint le ${dayFormatter.format(new Date(done.at))}`
                    : (counter?.label ?? milestone.detail)}
                </p>
              </div>
              {tasks.length > 0 && !done && (
                <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {tasksDone} / {tasks.length} tâche{tasks.length > 1 ? "s" : ""}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!progress.complete && growth && (
        <p className="mt-3 flex items-start gap-2 px-1 text-sm text-muted-foreground">
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Chaque jour sur ton Accueil, tes tâches : poster une vidéo et répondre aux commentaires. C'est ce qui te rapproche de ce palier.
        </p>
      )}

      {!progress.complete && (
        <>
          <Button asChild className="mt-6 w-full">
            <Link href="/accueil">
              Mes tâches du jour <ArrowRight />
            </Link>
          </Button>
          <div className="mt-4 flex">
            <button
              type="button"
              onClick={() => askGus(saas.id, `Je vise le palier « ${objective.title} » de ma roadmap. Comment je l'atteins le plus vite, pour mon projet ?`)}
              className="mx-auto flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <CoachAvatar className="h-6 w-6" /> Comment l'atteindre ? <span className="font-medium text-primary">Demande à {COACH_NAME}</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
