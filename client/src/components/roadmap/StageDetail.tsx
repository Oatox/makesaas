import { useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { stageProgress, type RoadmapMission, type RoadmapStage, type RoadmapState } from "@shared/roadmap";
import { missionCheckText } from "@shared/roadmap-missions";
import type { Saas } from "@shared/saas";
import { CoachMarkdown } from "@/components/coach/CoachMarkdown";
import { Button } from "@/components/ui/button";
import { useTickMission } from "@/hooks/use-roadmap";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MissionToolBlock } from "./MissionTools";

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/** One mission: its title, and once opened its tutorial, its tool and how it gets done. */
function Mission({
  mission,
  index,
  open,
  onToggle,
  saas,
  state,
}: {
  mission: RoadmapMission;
  index: number;
  open: boolean;
  onToggle: () => void;
  saas: Saas;
  state: RoadmapState;
}) {
  const { toast } = useToast();
  const tick = useTickMission(saas.id);
  const done = state.done[mission.key];
  const manual = mission.check.kind === "manual";
  const bodyId = `mission-${mission.key.replace(/[^a-z0-9]/gi, "-")}`;

  const setDone = (value: boolean) =>
    tick.mutate(
      { mission: mission.key, done: value },
      { onError: () => toast({ variant: "destructive", title: "Impossible d'enregistrer", description: "Réessaie dans un instant." }) },
    );

  return (
    <li className={cn("rounded-2xl border transition-colors", open ? "border-border bg-background/40" : "border-transparent")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
          )}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
        </span>
        <span className={cn("min-w-0 flex-1 text-[15px] font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/50")}>
          {mission.title}
        </span>
        {!manual && !done && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground sm:inline-flex">
            <Sparkles className="h-3 w-3" /> Auto
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-3 pb-4 pl-[52px]">
              <p className="text-sm text-muted-foreground">{mission.why}</p>
              <CoachMarkdown text={mission.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")} className="text-sm leading-relaxed" />
              {mission.tool && <MissionToolBlock tool={mission.tool} saas={saas} state={state} />}
              {mission.links && (
                <div className="flex flex-wrap gap-2">
                  {mission.links.map((link) => (
                    <Button key={link.href} asChild variant="secondary" size="sm">
                      <Link href={link.href}>
                        {link.label} <ArrowRight />
                      </Link>
                    </Button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                {done ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                      <Check className="h-4 w-4" />
                      {done.source === "before" ? "Fait avant MakeSaaS" : `Fait le ${dayFormatter.format(new Date(done.at))}`}
                    </span>
                    {manual && done.source === "declared" && (
                      <Button variant="ghost" size="sm" onClick={() => setDone(false)} disabled={tick.isPending}>
                        Annuler
                      </Button>
                    )}
                  </>
                ) : manual ? (
                  <Button onClick={() => setDone(true)} disabled={tick.isPending}>
                    {tick.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                    C'est fait
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4" /> {missionCheckText(mission.check)}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/**
 * A stage of the roadmap: what reaching it means, its progress, and its missions, each with its
 * tutorial. Opens on the first mission not done.
 */
export function StageDetail({
  stage,
  index,
  isCurrent,
  saas,
  state,
}: {
  stage: RoadmapStage;
  index: number;
  isCurrent: boolean;
  saas: Saas;
  state: RoadmapState;
}) {
  const progress = stageProgress(stage, state.done);
  const firstTodo = stage.missions.find((mission) => !state.done[mission.key])?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(firstTodo);

  return (
    <section className="card-3d p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Étape {index + 1}
        {progress.complete ? " · Terminée" : isCurrent ? " · En cours" : ""}
      </p>
      <h2 className="mt-2 font-display text-2xl font-light leading-tight sm:text-[32px]">{stage.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">{stage.detail}</p>

      <div className="mt-5 flex items-center gap-3">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </span>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {progress.done}/{progress.total}
        </span>
      </div>

      <ol className="mt-5 space-y-1">
        {stage.missions.map((mission, missionIndex) => (
          <Mission
            key={mission.key}
            mission={mission}
            index={missionIndex}
            open={openKey === mission.key}
            onToggle={() => setOpenKey((key) => (key === mission.key ? null : mission.key))}
            saas={saas}
            state={state}
          />
        ))}
      </ol>
    </section>
  );
}
