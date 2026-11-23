import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PartyPopper, Plus } from "lucide-react";
import type { Milestone, RoadmapState } from "@shared/roadmap";
import { milestonesFor, roadmapStagesFor } from "@shared/roadmap-missions";
import {
  currentMilestone,
  currentObjective,
  dayKey,
  doneTasks,
  milestoneCounter,
  objectivesOf,
  taskBlocker,
  tasksTickedAfter,
  todayPlan,
} from "@shared/today";
import { CoachAvatar } from "@/components/brand/Coach";
import { DoneTaskList, QuestTile, TaskDetail } from "@/components/roadmap/TaskCard";
import { NoSaasState } from "@/components/saas/NoSaasState";
import { ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoadmap } from "@/hooks/use-roadmap";
import { useSaas } from "@/hooks/use-saas";
import { useToast } from "@/hooks/use-toast";
import { blurIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });
/** On phones, the task's drawer rises from the bottom, up to near the top, over the dimmed page. */
const MOBILE_DRAWER = "max-h-[88dvh] overflow-y-auto rounded-t-[22px] border-x-0 border-[hsl(var(--line))] bg-card px-5 pt-7";
const MOBILE_OVERLAY =
  "bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

/**
 * The objective the member works towards (objectivesOf: launching the SaaS, then each MRR tier), as
 * the page's subtitle: "Objectif : lancer ton SaaS" and how many of its milestones are reached, its
 * milestones as segments (reached ones full, the one in progress filled by its figure, each named on
 * hover), and the next step: the milestone in progress. The same objectives group the Roadmap's.
 */
function ObjectiveBar({ milestones, state }: { milestones: Milestone[]; state: RoadmapState }) {
  const objectives = objectivesOf(milestones);
  const objective = currentObjective(objectives, state.done);
  const shown = objective ?? objectives.at(-1);
  if (!shown) return null;
  const current = objective ? currentMilestone(objective.milestones, state.done) : null;
  const counter = current ? milestoneCounter(current, state.progress) : null;
  const partial = counter ? Math.min(1, counter.value / counter.target) : 0;
  const reached = shown.milestones.filter((milestone) => state.done[milestone.key]).length;
  // "Lancer ton SaaS" → "Objectif : lancer ton SaaS".
  const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

  return (
    <section aria-label="Ton objectif" className="w-full min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 truncate font-display text-xl font-light leading-tight">
          {objective ? "Objectif" : "Objectif atteint"} : {lower(shown.title)}
        </p>
        <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {reached} / {shown.milestones.length}
        </p>
      </div>

      <div className="mt-4 flex gap-1.5">
        {shown.milestones.map((milestone) => {
          const done = !!state.done[milestone.key];
          const isCurrent = milestone === current;
          return (
            <span
              key={milestone.key}
              title={milestone.title}
              className={cn("h-1.5 flex-1 overflow-hidden rounded-full", done ? "bg-primary" : isCurrent ? "bg-primary/20" : "bg-secondary")}
            >
              {isCurrent && partial > 0 && (
                <span className="block h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${partial * 100}%` }} />
              )}
            </span>
          );
        })}
      </div>

      {current && (
        <p className="mt-3 truncate text-sm text-muted-foreground">
          Prochaine étape : <span className="text-foreground">{lower(current.title)}</span>
          {counter && ` · ${counter.label}`}
        </p>
      )}
    </section>
  );
}

/**
 * Accueil (/accueil): the day's tasks (shared/today.ts: todayPlan), the one thing a member does here.
 * Under the greeting, the objective in progress and its milestones (ObjectiveBar); then the day's
 * tasks as cards (QuestTile), the one to do now with "Commencer". A task opens in a drawer
 * (TaskDetail): its steps and "C'est fait", then the next one. Once all are done, one more on demand.
 * Under them, the tasks done before (DoneTaskList), each opening again in the same drawer.
 */
export default function Today() {
  const { currentSaas, isLoading: saasLoading } = useSaas();
  const roadmap = useRoadmap(currentSaas?.id);
  const state = roadmap.data;
  const { toast } = useToast();
  const stages = useMemo(() => (state ? roadmapStagesFor(state.goal) : []), [state?.goal]);
  const milestones = useMemo(() => (state ? milestonesFor(state.goal) : []), [state?.goal]);
  const day = dayKey(new Date());
  // Tasks asked on top of the day's ("Une tâche de plus"), until the page reloads.
  const [extra, setExtra] = useState(0);
  // The task open in the drawer; null: closed.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Another SaaS: its own day.
  useEffect(() => {
    setExtra(0);
    setOpenKey(null);
  }, [currentSaas?.id]);

  const plan = state ? todayPlan(stages, state.done, day, extra) : null;
  const tasks = plan?.tasks ?? [];
  const doneCount = state ? tasks.filter((task) => state.done[task.key]).length : 0;
  // The task to do now: the first one left that nothing holds back.
  const nextTask = state ? (tasks.find((task) => !state.done[task.key] && !taskBlocker(stages, state.done, task.key)) ?? null) : null;
  // The tasks done that are not in the day's list, the latest first.
  const history = state ? doneTasks(stages, state.done).filter(({ task }) => !tasks.some((item) => item.key === task.key)) : [];
  const openIndex = openKey ? tasks.findIndex((task) => task.key === openKey) : -1;
  const openTask = openIndex >= 0 ? tasks[openIndex] : (history.find(({ task }) => task.key === openKey)?.task ?? null);
  const goTo = (key: string) => {
    // The task to finish first is in the day's list, or added to it.
    if (!tasks.some((item) => item.key === key)) setExtra((count) => count + 1);
    setOpenKey(key);
  };

  // A task done while the page is open (ticked, or seen in the data): celebrated (its drawer offers the next one).
  const doneSignature = state
    ? tasks
        .filter((task) => state.done[task.key])
        .map((task) => task.key)
        .join(",")
    : "";
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!state) return;
    const doneKeys = tasks.filter((task) => state.done[task.key]).map((task) => task.key);
    const previous = seen.current;
    seen.current = new Set(doneKeys);
    if (!previous) return;
    const fresh = doneKeys.filter((key) => !previous.has(key));
    if (!fresh.length) return;
    const left = tasks.length - doneKeys.length;
    toast({
      title: "Tâche faite",
      description: left > 0 ? `Plus que ${left} aujourd'hui.` : "C'est tout pour aujourd'hui, bravo !",
    });
    // Runs when a task of the day gets done or undone, not on every new state object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneSignature]);

  if (!saasLoading && !currentSaas) {
    return <NoSaasState description="Tes tâches du jour suivent ton SaaS, de ton idée jusqu'à ton objectif." />;
  }

  const allDone = tasks.length > 0 && doneCount === tasks.length;

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="space-y-10 sm:space-y-14">
      {/* The objective in progress, at the top of the page. */}
      {state && !roadmap.isError && <ObjectiveBar milestones={milestones} state={state} />}

      {roadmap.isError ? (
        <ErrorState
          title="Impossible de charger ta journée"
          message={roadmap.error instanceof Error ? roadmap.error.message : "Réessaie dans un instant."}
          action={<Button onClick={() => void roadmap.refetch()}>Réessayer</Button>}
        />
      ) : !state || !currentSaas || !plan ? (
        <div className="space-y-5">
          <Skeleton className="h-7 w-56 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-44 rounded-[18px]" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* The day's tasks, given by Gus. */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <CoachAvatar className="h-10 w-10" online />
              <h2 className="font-display text-xl font-light leading-none sm:text-2xl">Tes tâches du jour</h2>
            </div>
            <ol className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {tasks.map((task) => (
                <QuestTile
                  key={task.key}
                  task={task}
                  isNext={task === nextTask}
                  blocker={taskBlocker(stages, state.done, task.key)}
                  state={state}
                  onOpen={() => setOpenKey(task.key)}
                />
              ))}
              {allDone && plan.more && (
                <li className="h-full">
                  <button
                    type="button"
                    onClick={() => setExtra((count) => count + 1)}
                    className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <Plus className="h-5 w-5" />
                    Une tâche de plus
                  </button>
                </li>
              )}
            </ol>
          </section>

          {allDone && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <PartyPopper className="h-4 w-4 text-primary" />
              {plan.phase === "launch" ? "Ton SaaS avance. Reviens demain pour la suite." : "Ton compte grandit vidéo après vidéo. Reviens demain."}
            </motion.p>
          )}

          {/* The tasks done before, to open again. */}
          {history.length > 0 && <DoneTaskList key={currentSaas.id} items={history} onOpen={setOpenKey} />}
        </>
      )}

      <Sheet open={!!openTask} onOpenChange={(value) => !value && setOpenKey(null)}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          overlayClassName={isMobile ? MOBILE_OVERLAY : undefined}
          className={isMobile ? MOBILE_DRAWER : "overflow-y-auto p-5 sm:max-w-xl sm:p-7"}
        >
          {openTask && state && currentSaas && (
            <>
              <SheetTitle className="sr-only">{openTask.title}</SheetTitle>
              <SheetDescription className="sr-only">Comment faire cette tâche, étape par étape.</SheetDescription>
              <TaskDetail
                key={openTask.key}
                task={openTask}
                place={openIndex >= 0 ? { number: openIndex + 1, total: tasks.length } : null}
                blocker={taskBlocker(stages, state.done, openTask.key)}
                later={tasksTickedAfter(stages, state.done, openTask.key)}
                next={openIndex >= 0 && nextTask && nextTask !== openTask ? nextTask : null}
                onGoTo={goTo}
                onClose={() => setOpenKey(null)}
                saas={currentSaas}
                state={state}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
