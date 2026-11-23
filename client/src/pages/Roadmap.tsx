import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { currentStageIndex, stageProgress } from "@shared/roadmap";
import { roadmapStagesFor } from "@shared/roadmap-missions";
import { RoadmapBackdrop } from "@/components/roadmap/RoadmapBackdrop";
import { RoadmapPath, STAGE_PANEL_ID } from "@/components/roadmap/RoadmapPath";
import { StageDetail } from "@/components/roadmap/StageDetail";
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
/** On phones, the stage's drawer rises from the bottom, up to near the top, over the dimmed page. */
const MOBILE_DRAWER = "max-h-[88dvh] rounded-t-[22px] border-x-0 border-[hsl(var(--line))] bg-card px-5 pt-7";
const MOBILE_OVERLAY =
  "bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

/**
 * /roadmap: the active SaaS's stages, from the idea to the member's goal, drawn as a winding path.
 * Clicking a stage opens its missions and their tutorials in a drawer on the side (from the bottom on
 * phones, over the dimmed page). Missions check
 * themselves from the SaaS's data, or the member ticks them (server/roadmap/, shared/roadmap.ts).
 */
export default function Roadmap() {
  const { currentSaas, isLoading: saasLoading } = useSaas();
  const roadmap = useRoadmap(currentSaas?.id);
  const state = roadmap.data;
  const stages = useMemo(() => (state ? roadmapStagesFor(state.goal) : []), [state?.goal]);
  const current = state ? currentStageIndex(stages, state.done) : null;
  const isMobile = useIsMobile();
  // The stage whose missions are open in the drawer; null: closed.
  const [open, setOpen] = useState<number | null>(null);

  // Another SaaS: its own roadmap, drawer closed.
  useEffect(() => setOpen(null), [currentSaas?.id]);

  if (!saasLoading && !currentSaas) {
    return <NoSaasState description="Ta roadmap suit ton SaaS, de ton idée jusqu'à ton objectif." />;
  }

  const missionsDone = state ? stages.reduce((total, stage) => total + stageProgress(stage, state.done).done, 0) : 0;
  const missionsTotal = stages.reduce((total, stage) => total + stage.missions.length, 0);
  const openStage = open !== null ? stages[open] : null;

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-light sm:text-[32px]">Ta roadmap</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            De ton idée à ton objectif. Clique sur une étape pour voir ses missions et leurs tutoriels.
          </p>
        </div>
        {state && (
          // Phones: a full-width row, the count and its bar on the left, the button on the right.
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{missionsDone}</span> mission{missionsDone > 1 ? "s" : ""}{" "}
                sur {missionsTotal}
              </p>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-secondary sm:hidden">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${missionsTotal ? (missionsDone / missionsTotal) * 100 : 0}%` }}
                />
              </span>
            </div>
            {current !== null && (
              <Button onClick={() => setOpen(current)} className="shrink-0">
                Reprendre <ArrowRight />
              </Button>
            )}
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
            <RoadmapPath stages={stages} done={state.done} current={current} open={openStage ? open : null} onToggle={setOpen} />
          )}
        </RoadmapBackdrop>
      )}

      <Sheet open={openStage !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <SheetContent
          id={STAGE_PANEL_ID}
          side={isMobile ? "bottom" : "right"}
          overlayClassName={isMobile ? MOBILE_OVERLAY : undefined}
          className={isMobile ? MOBILE_DRAWER : "overflow-y-auto p-5 sm:max-w-xl sm:p-7"}
        >
          {openStage && state && currentSaas && (
            <>
              <SheetTitle className="sr-only">{openStage.title}</SheetTitle>
              <SheetDescription className="sr-only">Les missions de cette étape, avec leurs tutoriels.</SheetDescription>
              <StageDetail key={openStage.key} stage={openStage} index={open!} isCurrent={open === current} saas={currentSaas} state={state} onOpenStage={setOpen} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
