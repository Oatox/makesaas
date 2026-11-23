import type { TaskIllustration } from "@shared/roadmap";
import { cn } from "@/lib/utils";

/**
 * A task's banner, at the top of its card (QuestTile; not in its drawer): a quiet dotted
 * ground. It carries the task's kind of work (TASK_ILLUSTRATIONS, illustrationOf), kept for the
 * images each kind will get; `muted` greys it (a locked task).
 */
export function TaskBanner({ illustration, muted = false, className }: { illustration: TaskIllustration; muted?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      data-illustration={illustration}
      className={cn(
        "h-28 bg-secondary/30 bg-[radial-gradient(hsl(var(--foreground)/0.07)_1px,transparent_1px)] [background-size:14px_14px]",
        muted && "opacity-50",
        className,
      )}
    />
  );
}
