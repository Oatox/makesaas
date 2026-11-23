import { Check, ChevronRight, Flag } from "lucide-react";
import { stageProgress, type MissionDone, type RoadmapStage } from "@shared/roadmap";
import { cn } from "@/lib/utils";

/**
 * The roadmap, every stage as a big clickable card on a timeline: done ones checked, the current one
 * outlined, each with its missions' progress. Clicking one shows its missions (StageDetail).
 */
export function StageList({
  stages,
  done,
  current,
  selected,
  onSelect,
}: {
  stages: RoadmapStage[];
  done: Record<string, MissionDone>;
  /** The stage the member is on; null once every stage is done. */
  current: number | null;
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="space-y-3">
      {stages.map((stage, index) => {
        const progress = stageProgress(stage, done);
        const isCurrent = index === current;
        const isSelected = index === selected;
        const last = index === stages.length - 1;
        return (
          <li key={stage.key} className="relative">
            {/* The trail to the next stage, orange once this one is done. */}
            {!last && (
              <span
                aria-hidden
                className={cn("absolute left-[35px] top-[60px] h-[calc(100%-36px)] w-0.5", progress.complete ? "bg-primary" : "bg-border")}
              />
            )}
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={isSelected ? "step" : undefined}
              className={cn(
                "relative flex w-full items-center gap-4 rounded-[18px] border p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                isSelected
                  ? "border-primary/70 bg-primary/[0.07] shadow-[0_6px_16px_-12px_hsl(var(--primary)/0.4)]"
                  : "border-border bg-card/60 hover:border-foreground/20 hover:bg-secondary/50",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  progress.complete
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-background text-primary"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {progress.complete ? <Check className="h-5 w-5" strokeWidth={3} /> : stage.isGoal ? <Flag className="h-4 w-4" /> : index + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  Étape {index + 1}
                  {isCurrent && <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">En cours</span>}
                  {stage.isGoal && !isCurrent && <span className="font-medium text-primary">Ton objectif</span>}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate font-display text-lg font-light leading-tight sm:text-xl",
                    !progress.complete && !isCurrent && "text-foreground/80",
                  )}
                >
                  {stage.title}
                </span>
                <span className="mt-2 flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {progress.done}/{progress.total} mission{progress.total > 1 ? "s" : ""}
                  </span>
                </span>
              </span>

              <ChevronRight className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isSelected && "text-primary")} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
