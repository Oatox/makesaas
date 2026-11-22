import type { ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowRight, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * "Continuer" of the screens that do not advance on tap: full width, pinned to the bottom (same
 * layout on every screen size). An `extension` (a field) can grow out of it: the field sits on
 * top and the button closes the same frame, as one block.
 */
export function ContinueButton({
  onClick,
  variants,
  disabled,
  label = "Continuer",
  extension,
  className,
}: {
  onClick: () => void;
  variants?: Variants;
  disabled?: boolean;
  label?: string;
  extension?: ReactNode;
  /** Wrapper classes on top (a tighter gap above the button on a screen that must fit). */
  className?: string;
}) {
  const extended = !!extension;

  return (
    <motion.div variants={variants} className={cn("mt-auto pt-8", className)}>
      <div
        className={cn(
          "rounded-[30px] border transition-[padding,background-color,border-color] duration-300 md:rounded-[34px]",
          extended ? "border-border bg-card p-1.5" : "border-transparent p-0",
        )}
      >
        <AnimatePresence initial={false}>
          {extended && (
            <motion.div
              key="extension"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              {extension}
            </motion.div>
          )}
        </AnimatePresence>

        <Button className="group h-12 w-full text-base md:h-14 md:text-lg" onClick={onClick} disabled={disabled} data-testid="button-onboarding-continue">
          {label}
          <ArrowRight className="!size-[18px] transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * Field growing out of "Continuer" (see `extension`): a label, then a recessed input with a pencil,
 * so it reads as a place to write; its border turns orange while typing. Enter continues.
 */
export function ContinueField({
  label,
  placeholder,
  value,
  maxLength,
  autoFocus,
  onChange,
  onSubmit,
}: {
  label?: string;
  placeholder: string;
  value: string;
  maxLength: number;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <label className="block px-2.5 pb-2.5 pt-3 md:px-3">
      {label && <span className="block px-1.5 text-sm text-muted-foreground">{label}</span>}
      <span
        className={cn(
          "mt-2 flex h-12 items-center gap-3 rounded-[18px] border border-border bg-background/60 px-4 shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] md:h-14",
          "transition-colors focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/25",
        )}
      >
        <PenLine aria-hidden className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <input
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoFocus={autoFocus}
          enterKeyHint="next"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onSubmit();
          }}
          aria-label={label ?? placeholder}
          className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground md:text-lg"
          data-testid="input-onboarding-detail"
        />
      </span>
    </label>
  );
}
