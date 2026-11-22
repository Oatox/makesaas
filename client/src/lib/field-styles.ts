// Shared look of every form field (Input, Textarea, Select trigger, and wrappers around an input
// such as the team picker): same shape as the 3D buttons, raised card surface with a subtle inner
// shadow, orange (primary) border and ring while focused or open. Change the field look here only.
//
// The hover border is skipped while the field is focused/open: Tailwind emits `hover:` after
// `focus-within:`, so a plain `hover:` would repaint the orange border white under the cursor.
// `:focus-within` also matches a focused input itself, so one rule covers fields and wrappers.
export const fieldClass =
  "w-full rounded-[10px] border border-border bg-card px-3.5 text-base text-foreground " +
  "shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] transition-colors placeholder:text-muted-foreground " +
  "[&:hover:not(:focus-within):not([data-state=open])]:border-foreground/25 " +
  "focus-visible:outline-none focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/25 " +
  "data-[state=open]:border-primary/70 data-[state=open]:ring-2 data-[state=open]:ring-primary/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

// Taller text fields of the full-page forms (auth, settings); look and focus still come from fieldClass.
export const tallInputClass = "h-12 px-4 md:h-12 md:text-base";
