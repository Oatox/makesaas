import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
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
  todayPlan,
} from "@shared/today";
import { CoachAvatar } from "@/components/brand/Coach";
import { DayTaskList } from "@/components/roadmap/DayTaskList";
import { DoneTaskList, TaskDetail } from "@/components/roadmap/TaskCard";
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

/** When the member asked new tasks on Accueil ("Demander de nouvelles tâches"), for each SaaS and day. */
const seriesKey = (saasId: string) => `makesaas:today-series:${saasId}`;

function loadSeries(saasId: string | undefined, day: string): string | null {
  if (!saasId) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(seriesKey(saasId)) ?? "null") as { day?: unknown; since?: unknown } | null;
    return saved?.day === day && typeof saved.since === "string" ? saved.since : null;
  } catch {
    return null;
  }
}

function saveSeries(saasId: string, day: string, since: string) {
  try {
    localStorage.setItem(seriesKey(saasId), JSON.stringify({ day, since }));
  } catch {
    // Storage unavailable (private mode): the series lasts until the page reloads.
  }
}
/** On phones, the task's drawer rises from the bottom, up to near the top, over the dimmed page. */
const MOBILE_DRAWER = "max-h-[88dvh] overflow-y-auto rounded-t-[22px] border-x-0 border-[hsl(var(--line))] bg-card px-5 pt-7";
const MOBILE_OVERLAY =
  "bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

/**
 * The objective in progress, at the top of the page (objectivesOf: the same as the Roadmap's nodes):
 * its place ("Objectif 1 sur 7", or "Objectif final"), its title and how many of its steps are passed,
 * its steps as segments (passed ones full, the one in progress filled by its figure, each named on
 * hover), and the step in progress with its figure. An objective of a single step (an amount per month)
 * shows its figure instead.
 */
function ObjectiveBar({ milestones, state }: { milestones: Milestone[]; state: RoadmapState }) {
  const objectives = objectivesOf(milestones);
  const objective = currentObjective(objectives, state.done);
  const shown = objective ?? objectives.at(-1);
  if (!shown) return null;
  const index = objectives.indexOf(shown);
  const isLast = index === objectives.length - 1;
  const current = objective ? currentMilestone(objective.milestones, state.done) : null;
  const counter = current ? milestoneCounter(current, state.progress) : null;
  const partial = counter ? Math.min(1, counter.value / counter.target) : 0;
  const reached = shown.milestones.filter((milestone) => state.done[milestone.key]).length;
  const single = shown.milestones.length === 1;

  return (
    <section aria-label="Ton objectif" className="w-full min-w-0">
      <p className="text-sm text-muted-foreground">
        {!objective ? "Objectif final atteint" : isLast ? "Objectif final" : `Objectif ${index + 1} sur ${objectives.length}`}
      </p>
      <div className="mt-1.5 flex items-baseline justify-between gap-4">
        <p className="min-w-0 truncate font-display text-xl font-light leading-tight sm:text-2xl">{shown.title}</p>
        <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {single ? (counter?.label ?? "") : `${reached} / ${shown.milestones.length} étapes`}
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

      {current && !single && (
        <p className="mt-3 truncate text-sm text-muted-foreground">
          Étape en cours : <span className="text-foreground">{current.title}</span>
          {counter && ` · ${counter.label}`}
        </p>
      )}
    </section>
  );
}

/**
 * Accueil (/accueil): the day's tasks (shared/today.ts: todayPlan), the one thing a member does here.
 * At the top, the objective in progress and its steps (ObjectiveBar); then the day's
 * tasks as one list (DayTaskList), the one to do now outlined in orange, and the time they still take.
 * A task opens in a drawer (TaskDetail): its instructions one at a time, then "Tâche suivante". Once all
 * are done, new ones on demand ("Demander de nouvelles tâches": those done go under the list).
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
  // Tasks added to the day's (the one to finish first, from "Y aller"), until the page reloads.
  const [extra, setExtra] = useState(0);
  // When the member last asked new tasks today ("Demander de nouvelles tâches"): kept on this device.
  const [since, setSince] = useState<string | null>(() => loadSeries(currentSaas?.id, day));
  // The task open in the drawer; null: closed.
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The drawer opened in full screen (its corner button), until it closes.
  const [expanded, setExpanded] = useState(false);
  const closeTask = () => {
    setOpenKey(null);
    setExpanded(false);
  };
  const isMobile = useIsMobile();

  // Another SaaS: its own day.
  useEffect(() => {
    setExtra(0);
    setSince(loadSeries(currentSaas?.id, day));
    setOpenKey(null);
    setExpanded(false);
  }, [currentSaas?.id, day]);

  const plan = state ? todayPlan(stages, state.done, day, extra, since) : null;
  const tasks = plan?.tasks ?? [];
  const doneCount = state ? tasks.filter((task) => state.done[task.key]).length : 0;
  // The task to do now: the first one left that nothing holds back.
  const nextTask = state ? (tasks.find((task) => !state.done[task.key] && !taskBlocker(stages, state.done, task.key)) ?? null) : null;
  // The tasks done that are not in the day's list, the latest first.
  const history = state ? doneTasks(stages, state.done).filter(({ task }) => !tasks.some((item) => item.key === task.key)) : [];
  const openIndex = openKey ? tasks.findIndex((task) => task.key === openKey) : -1;
  const openTask = openIndex >= 0 ? tasks[openIndex] : (history.find(({ task }) => task.key === openKey)?.task ?? null);
  // The day's task to open after the open one: the first left that nothing holds back once it is done.
  const afterOpen =
    state && openIndex >= 0
      ? (tasks.find((task) => {
          if (task.key === openKey || state.done[task.key]) return false;
          const blocker = taskBlocker(stages, state.done, task.key);
          return !blocker || blocker.key === openKey;
        }) ?? null)
      : null;
  const goTo = (key: string) => {
    // The task to finish first is in the day's list, or added to it.
    if (!tasks.some((item) => item.key === key)) setExtra((count) => count + 1);
    setOpenKey(key);
  };
  // "Demander de nouvelles tâches": the tasks done so far go to "Tâches accomplies", the next ones
  // come (todayPlan's `since`). Just after the latest done, whatever the clocks of the device and the
  // server say, so all of them leave the list.
  const startSeries = () => {
    if (!state || !currentSaas) return;
    const latest = Math.max(Date.now(), ...tasks.map((task) => Date.parse(state.done[task.key]?.at ?? "") || 0));
    const at = new Date(latest + 1).toISOString();
    saveSeries(currentSaas.id, day, at);
    setSince(at);
    setExtra(0);
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
      {/* The objective in progress and its steps, at the top of the page. */}
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
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* The day's tasks, given by Gus. */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <CoachAvatar className="h-10 w-10" online />
              <h2 className="min-w-0 flex-1 font-display text-xl font-light leading-none sm:text-2xl">Tes tâches du jour</h2>
            </div>
            <DayTaskList
              tasks={tasks}
              stages={stages}
              state={state}
              nextTask={nextTask}
              onOpen={setOpenKey}
              onMore={allDone && plan.more ? startSeries : undefined}
            />
          </section>

          {/* The tasks done before, to open again. */}
          {history.length > 0 && <DoneTaskList key={currentSaas.id} items={history} onOpen={setOpenKey} />}
        </>
      )}

      <Sheet open={!!openTask} onOpenChange={(value) => !value && closeTask()}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          overlayClassName={isMobile ? MOBILE_OVERLAY : undefined}
          className={
            isMobile
              ? cn(MOBILE_DRAWER, expanded && "h-[100dvh] max-h-[100dvh] rounded-t-none")
              : cn(
                  "overflow-y-auto p-5 transition-[max-width] duration-300 ease-out sm:p-7",
                  expanded ? "sm:max-w-[calc(100vw-1rem)] sm:p-10" : "sm:max-w-xl",
                )
          }
        >
          {openTask && state && currentSaas && (
            <div className={cn(expanded && "mx-auto max-w-2xl")}>
              {/* Full screen, or back to the drawer: next to the close button. */}
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? "Réduire la tâche" : "Ouvrir la tâche en grand"}
                title={expanded ? "Réduire" : "Ouvrir en grand"}
                className="absolute right-[3.75rem] top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:top-4 sm:h-9 sm:w-9"
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <SheetTitle className="sr-only">{openTask.title}</SheetTitle>
              <SheetDescription className="sr-only">Comment faire cette tâche, étape par étape.</SheetDescription>
              <TaskDetail
                key={openTask.key}
                task={openTask}
                place={openIndex >= 0 ? { number: openIndex + 1, total: tasks.length } : null}
                blocker={taskBlocker(stages, state.done, openTask.key)}
                next={afterOpen}
                onGoTo={goTo}
                onClose={closeTask}
                saas={currentSaas}
                state={state}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
