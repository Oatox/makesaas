import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { currentStageIndex, stageProgress } from "@shared/roadmap";
import { roadmapStagesFor } from "@shared/roadmap-missions";
import { StageDetail } from "@/components/roadmap/StageDetail";
import { StageList } from "@/components/roadmap/StageList";
import { NoSaasState } from "@/components/saas/NoSaasState";
import { ErrorState } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoadmap } from "@/hooks/use-roadmap";
import { useSaas } from "@/hooks/use-saas";
import { blurIn } from "@/lib/motion";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

/**
 * /roadmap: the active SaaS's stages, from the idea to the member's goal, as a big timeline. Each
 * stage opens on the side (below on small screens) with its missions and their tutorials. Missions
 * check themselves from the SaaS's data, or the member ticks them (server/roadmap/, shared/roadmap.ts).
 */
export default function Roadmap() {
  const { currentSaas, isLoading: saasLoading } = useSaas();
  const roadmap = useRoadmap(currentSaas?.id);
  const state = roadmap.data;
  const stages = useMemo(() => (state ? roadmapStagesFor(state.goal) : []), [state?.goal]);
  const current = state ? currentStageIndex(stages, state.done) : null;
  // The stage shown: the member's current one until they pick another.
  const [picked, setPicked] = useState<number | null>(null);
  const selected = Math.min(picked ?? current ?? stages.length - 1, Math.max(0, stages.length - 1));
  const detailRef = useRef<HTMLDivElement>(null);

  // Another SaaS: back to its current stage.
  useEffect(() => setPicked(null), [currentSaas?.id]);

  const select = (index: number) => {
    setPicked(index);
    // Below the list on small screens: bring the stage into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  if (!saasLoading && !currentSaas) {
    return <NoSaasState description="Ta roadmap suit ton SaaS, de ton idée jusqu'à ton objectif." />;
  }

  const missionsDone = state ? stages.reduce((total, stage) => total + stageProgress(stage, state.done).done, 0) : 0;
  const missionsTotal = stages.reduce((total, stage) => total + stage.missions.length, 0);

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-light sm:text-[32px]">Ta roadmap</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            De ton idée à ton objectif. Chaque étape a ses missions, avec un tutoriel pour chacune.
          </p>
        </div>
        {state && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{missionsDone}</span> mission{missionsDone > 1 ? "s" : ""} sur {missionsTotal}
          </p>
        )}
      </div>

      {roadmap.isError ? (
        <ErrorState
          title="Impossible de charger ta roadmap"
          message={roadmap.error instanceof Error ? roadmap.error.message : "Réessaie dans un instant."}
          action={<Button onClick={() => void roadmap.refetch()}>Réessayer</Button>}
        />
      ) : !state || !currentSaas ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-[92px] rounded-[18px]" />
            ))}
          </div>
          <Skeleton className="h-[520px] rounded-[18px]" />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <StageList stages={stages} done={state.done} current={current} selected={selected} onSelect={select} />
          <div ref={detailRef} className="scroll-mt-4 lg:sticky lg:top-4">
            <StageDetail
              key={stages[selected].key}
              stage={stages[selected]}
              index={selected}
              isCurrent={selected === current}
              saas={currentSaas}
              state={state}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
