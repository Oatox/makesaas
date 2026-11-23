import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flag, Rocket, TrendingUp, type LucideIcon } from "lucide-react";
import { milestonesFor, roadmapStagesFor } from "@shared/roadmap-missions";
import { currentObjective, objectiveProgress, objectivesOf, type Objective } from "@shared/today";
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
/** On phones, the milestone's drawer rises from the bottom, up to near the top, over the dimmed page. */
const MOBILE_DRAWER = "max-h-[88dvh] overflow-y-auto rounded-t-[22px] border-x-0 border-[hsl(var(--line))] bg-card px-5 pt-7";
const MOBILE_OVERLAY =
  "bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** The launch has its rocket, the MRR tiers share a curve, the goal has its flag. */
const iconOf = (objective: Objective, isGoal: boolean): LucideIcon => (isGoal ? Flag : objective.key === "launch" ? Rocket : TrendingUp);

/**
 * /roadmap: the active SaaS's milestones, from launching it to the member's goal, drawn as a winding
 * path: one per objective of Accueil (objectivesOf: launching the SaaS, then each MRR tier), made of
 * steps (the milestones of shared/roadmap-missions.ts). Nothing to do or tick here: each step is checked
 * from the SaaS's data (server/roadmap/); a milestone says when it was reached, or, in progress, how far
 * it is ("2 / 6 étapes", "64 € / 100 € par mois"). Clicking one opens its drawer (ObjectiveDetail): its
 * steps and where each stands. What to do is on Accueil, the day's tasks.
 */
export default function Roadmap() {
  const { currentSaas, isLoading: saasLoading } = useSaas();
  const roadmap = useRoadmap(currentSaas?.id);
  const state = roadmap.data;
  const milestones = useMemo(() => (state ? milestonesFor(state.goal) : []), [state?.goal]);
  const stages = useMemo(() => (state ? roadmapStagesFor(state.goal) : []), [state?.goal]);
  const objectives = useMemo(() => objectivesOf(milestones), [milestones]);
  const isMobile = useIsMobile();
  // The milestone (objective) whose drawer is open; null: closed.
  const [open, setOpen] = useState<number | null>(null);

  // Another SaaS: its own roadmap, drawer closed.
  useEffect(() => setOpen(null), [currentSaas?.id]);

  if (!saasLoading && !currentSaas) {
    return <NoSaasState description="Ta roadmap suit ton SaaS, de ton idée jusqu'à ton objectif." />;
  }

  const inProgress = state ? currentObjective(objectives, state.done) : null;
  const current = inProgress ? objectives.indexOf(inProgress) : null;
  const reached = state ? objectives.filter((objective) => objectiveProgress(objective, state.done, state.progress).complete).length : 0;

  const nodes: PathNode[] = state
    ? objectives.map((objective, index) => {
        const progress = objectiveProgress(objective, state.done, state.progress);
        const isGoal = index === objectives.length - 1;
        return {
          key: objective.key,
          kicker: isGoal ? "Ton objectif" : `Palier ${index + 1}`,
          title: objective.title,
          status: progress.complete
            ? progress.reachedAt?.source === "before"
              ? "Avant MakeSaaS"
              : `Atteint le ${dayFormatter.format(new Date(progress.reachedAt?.at ?? Date.now()))}`
            : index === current
              ? progress.total === 1 && progress.counter
                ? progress.counter.label
                : `${progress.reached} / ${progress.total} étapes`
              : "À venir",
          done: progress.complete,
          progress: progress.share,
          icon: iconOf(objective, isGoal),
          ...(isGoal ? { isGoal: true } : {}),
        };
      })
    : [];

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-light sm:text-[32px]">Ta roadmap</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Tes paliers, du lancement à ton objectif. Ils se valident tout seuls, à partir de tes données.
          </p>
        </div>
        {state && (
          <div className="w-full sm:w-auto">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{reached}</span> palier{reached > 1 ? "s" : ""} sur {objectives.length}
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
          className={isMobile ? MOBILE_DRAWER : "overflow-y-auto p-5 sm:max-w-lg sm:p-7"}
        >
          {open !== null && objectives[open] && state && currentSaas && (
            <>
              <SheetTitle className="sr-only">{objectives[open].title}</SheetTitle>
              <SheetDescription className="sr-only">Ce palier, ses étapes et où tu en es.</SheetDescription>
              <ObjectiveDetail
                key={objectives[open].key}
                objective={objectives[open]}
                index={open}
                objectives={objectives}
                milestones={milestones}
                stages={stages}
                isCurrent={open === current}
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
