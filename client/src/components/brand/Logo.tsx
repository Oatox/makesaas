import { cn } from "@/lib/utils";

/** The mark alone: an orange rounded square with an "M" (same drawing as /brand/favicon.svg). */
function Mark({ x = 0, size = 48 }: { x?: number; size?: number }) {
  const scale = size / 512;
  return (
    <g transform={`translate(${x} 0) scale(${scale})`}>
      <rect width="512" height="512" rx="112" fill="hsl(var(--primary))" />
      <path
        d="M136 368V160l120 128 120-128v208"
        fill="none"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * MakeSaaS brand logo, drawn in SVG so it follows the theme colors.
 * - "full": the mark + "MakeSaaS" wordmark
 * - "mark": the mark alone, for tight spots (collapsed sidebar...)
 * Size it with a height class (`h-7`); the width follows the viewBox ratio.
 */
export function Logo({ variant = "full", className }: { variant?: "full" | "mark"; className?: string }) {
  if (variant === "mark") {
    return (
      <svg viewBox="0 0 48 48" role="img" aria-label="MakeSaaS" className={cn("h-8 w-8 shrink-0", className)}>
        <Mark />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 200 48" role="img" aria-label="MakeSaaS" className={cn("h-7 w-auto shrink-0", className)}>
      <Mark />
      {/* textLength pins the wordmark width whatever font ends up rendering it. */}
      <text
        x="58"
        y="35"
        textLength="140"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-display)"
        fontSize="32"
        fontWeight="700"
        fill="currentColor"
      >
        Make<tspan fill="hsl(var(--primary))">SaaS</tspan>
      </text>
    </svg>
  );
}
