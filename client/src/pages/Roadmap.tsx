import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, HandCoins, Rocket, TrendingUp, Trophy, type LucideIcon } from "lucide-react";
import { milestonesFor, roadmapStagesFor } from "@shared/roadmap-missions";
import { currentObjective, milestoneTasks, objectiveProgress, objectiveShare, objectivesOf, type Objective } from "@shared/today";
import { ObjectiveDetail } from "@/components/roadmap/ObjectiveDetail";
import { RoadmapBackdrop } from "@/components/roadmap/RoadmapBackdrop";
import { MILESTONE_PANEL_ID, RoadmapPath, type PathNode } from "@/components/roadmap/RoadmapPath";
import { NoSaasState } from "@/components/saas/NoSaasState";
import { ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoadmap } from "@/hooks/use-roadmap";
import { useSaas } from "@/hooks/use-saas";
import { blurIn } from "@/lib/motion";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });
/**
 * On phones, the objective's drawer rises from the bottom, up to near the top, over the dimmed page.
 * Its content scrolls, its buttons stay at the bottom (ObjectiveDetail).
 */
const MOBILE_DRAWER =
  "flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-t-[22px] border-x-0 border-[hsl(var(--line))] bg-card p-0 sm:p-0";
const DESKTOP_DRAWER = "flex flex-col gap-0 p-0 sm:max-w-lg";
const MOBILE_OVERLAY =
  "bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** The launch has its rocket, the first video and customer theirs, the amounts share a curve, the last one its trophy. */
const ICONS: Record<string, LucideIcon> = { launch: Rocket, first_video: Clapperboard, first_customer: HandCoins };
const iconOf = (objective: Objective, isLast: boolean): LucideIcon => (isLast ? Trophy : (ICONS[objective.key] ?? TrendingUp));

/**
 * /roadmap: the active SaaS's objectives (objectivesOf: "Lancer ton SaaS", "Première vidéo", "Premier
 * client", then each amount per month up to the member's goal, the last one), drawn as a winding path,
 * the same objective as the top of Accueil. Nothing to do or tick here: each objective is made of steps
 * (the milestones of shared/roadmap-missions.ts) checked from the SaaS's data (server/roadmap/); an
 * objective says when it was reached or, in progress, how far it is ("2 / 4 étapes", or the figure of its
 * single step: "64 € / 100 € par mois"). Clicking one opens its drawer (ObjectiveDetail): its steps and
 * where each stands. What to do is on Accueil, the day's tasks.
 */
export default function Roadmap() {
  const { currentSaas, isLoading: saasLoading } = useSaas();
  const roadmap = useRoadmap(currentSaas?.id);
  const state = roadmap.data;
  const milestones = useMemo(() => (state ? milestonesFor(state.goal) : []), [state?.goal]);
  const stages = useMemo(() => (state ? roadmapStagesFor(state.goal) : []), [state?.goal]);
  const objectives = useMemo(() => objectivesOf(milestones), [milestones]);
  const isMobile = useIsMobile();
  // The objective whose drawer is open; null: closed.
  const [open, setOpen] = useState<number | null>(null);

  // Another SaaS: its own roadmap, drawer closed.
  useEffect(() => setOpen(null), [currentSaas?.id]);

  if (!saasLoading && !currentSaas) {
    return <NoSaasState description="Ta roadmap suit ton SaaS, de ton idée jusqu'à ton objectif final." />;
  }

  const inProgress = state ? currentObjective(objectives, state.done) : null;
  const current = inProgress ? objectives.indexOf(inProgress) : null;
  const reached = state ? objectives.filter((objective) => objectiveProgress(objective, state.done, state.progress).complete).length : 0;

  const nodes: PathNode[] = state
    ? objectives.map((objective, index) => {
        const progress = objectiveProgress(objective, state.done, state.progress);
        const isLast = index === objectives.length - 1;
        const single = objective.milestones.length === 1 ? objective.milestones[0] : null;
        // A single step without its figure: how far its tasks are.
        const tasks = single && index === current && !progress.counter ? milestoneTasks(stages, milestones, single.key) : [];
        const tasksDone = tasks.filter((task) => state.done[task.key]).length;
        return {
          key: objective.key,
          kicker: isLast ? "Objectif final" : `Objectif ${index + 1}`,
          title: objective.title,
          status: progress.complete
            ? progress.reachedAt?.source === "before"
              ? "Avant MakeSaaS"
              : `Atteint le ${dayFormatter.format(new Date(progress.reachedAt?.at ?? Date.now()))}`
            : index === current
              ? single
                ? (progress.counter?.label ?? (tasks.length ? `${tasksDone} / ${tasks.length} tâches` : "En cours"))
                : `${progress.reached} / ${progress.total} étapes`
              : "À venir",
          done: progress.complete,
          // The steps passed, and those in progress by their figure or their tasks done: as in the drawer.
          progress: objectiveShare(stages, milestones, objective, state.done, state.progress),
          icon: iconOf(objective, isLast),
          ...(isLast ? { isGoal: true } : {}),
        };
      })
    : [];

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-light sm:text-[32px]">Ta roadmap</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Tes objectifs, du lancement à ton objectif final. Ils se valident tout seuls, à partir de tes données.
          </p>
        </div>
        {state && (
          <div className="w-full sm:w-auto">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{reached}</span> objectif{reached > 1 ? "s" : ""} atteint{reached > 1 ? "s" : ""} sur {objectives.length}
            </p>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-secondary sm:w-40">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${objectives.length ? (reached / objectives.length) * 100 : 0}%` }}
              />
            </span>
          </div>
        )}
      </div>

      {roadmap.isError ? (
        <ErrorState
          title="Impossible de charger ta roadmap"
          message={roadmap.error instanceof Error ? roadmap.error.message : "Réessaie dans un instant."}
          action={<Button onClick={() => void roadmap.refetch()}>Réessayer</Button>}
        />
      ) : (
        <RoadmapBackdrop>
          {!state || !currentSaas ? (
            <div className="mx-auto max-w-[720px] space-y-10">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="mx-auto h-[76px] w-[76px] rounded-full" />
              ))}
            </div>
          ) : (
            <RoadmapPath nodes={nodes} current={current} open={open} onOpen={setOpen} />
          )}
        </RoadmapBackdrop>
      )}

      <Sheet open={open !== null && !!objectives[open]} onOpenChange={(value) => !value && setOpen(null)}>
        <SheetContent
          id={MILESTONE_PANEL_ID}
          side={isMobile ? "bottom" : "right"}
          overlayClassName={isMobile ? MOBILE_OVERLAY : undefined}
          className={isMobile ? MOBILE_DRAWER : DESKTOP_DRAWER}
        >
          {open !== null && objectives[open] && state && currentSaas && (
            <>
              <SheetTitle className="sr-only">{objectives[open].title}</SheetTitle>
              <SheetDescription className="sr-only">Cet objectif, ses étapes et où tu en es.</SheetDescription>
              <ObjectiveDetail
                key={objectives[open].key}
                objective={objectives[open]}
                index={open}
                objectives={objectives}
                milestones={milestones}
                stages={stages}
                isCurrent={open === current}
                icon={iconOf(objectives[open], open === objectives.length - 1)}
                state={state}
                saas={currentSaas}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
