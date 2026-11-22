import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Square tick of a checkable row (multiple choice): the pick does not rely on color alone. */
export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-200 md:h-6 md:w-6",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
      )}
    >
      {checked && <Check className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={3} />}
    </span>
  );
}
