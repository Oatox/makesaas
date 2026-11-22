import { cn } from "@/lib/utils";

/** Look of an answer card, shared by single and multiple choice steps (layout classes come on top). */
export function optionCardClass(selected: boolean) {
  return cn(
    "relative overflow-hidden rounded-2xl border",
    "bg-gradient-to-b from-card to-background/40 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]",
    "transition-[border-color,background-color,box-shadow] duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
    selected
      ? "border-primary/80 bg-primary/[0.07] shadow-[0_6px_16px_-12px_hsl(var(--primary)/0.35)]"
      : "border-border hover:border-foreground/20 hover:bg-secondary/50",
  );
}

/** Soft orange wash from the left once the card is selected. */
export function SelectionWash({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent transition-opacity duration-300",
        selected ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
