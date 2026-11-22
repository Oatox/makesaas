import { useId } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { motion, PresenceContext, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  title?: string;
  icon?: LucideIcon;
  /** Shown dimmed after the label, e.g. how many items the option lists. */
  count?: number;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Période de forme". */
  label: string;
  className?: string;
};

/**
 * Small single-choice switch in the app's look: a recessed track (same inner shadow as the
 * form fields) with an orange-tinted thumb that slides to the selected option.
 * Radix ToggleGroup provides roving focus, arrow-key navigation and pressed state.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  // One shared layout id per instance, so several controls on a page animate independently.
  const thumbId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      // Radix emits "" when the active item is clicked again: a segmented control always keeps one.
      onValueChange={(next) => next && onValueChange(next as T)}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[10px] border border-border bg-background/60 p-[3px]",
        "shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)]",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            title={option.title}
            className={cn(
              // flex-1: options share the width when the control is stretched (e.g. full width on mobile).
              "relative flex flex-1 justify-center rounded-[7px] px-3 py-1 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              // Kept out of any parent AnimatePresence: once the thumb has slid, framer-motion keeps the
              // previous thumb in the layoutId stack and waits for it forever, so a page leaving with
              // mode="wait" never unmounts and whatever replaces it (the analysis loader) never shows.
              <PresenceContext.Provider value={null}>
                <motion.span
                  layoutId={thumbId}
                  aria-hidden
                  className="absolute inset-0 rounded-[7px] bg-primary/15 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)] ring-1 ring-inset ring-primary/35"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                />
              </PresenceContext.Provider>
            )}
            <span className="relative flex items-center gap-1.5 whitespace-nowrap">
              {option.icon && <option.icon className="size-3.5 shrink-0" aria-hidden />}
              {option.label}
              {option.count !== undefined && <span className="tabular-nums opacity-60">{option.count}</span>}
            </span>
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}
