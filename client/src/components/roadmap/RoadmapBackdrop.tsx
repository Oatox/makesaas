import type { ReactNode } from "react";

/** A grid of faint dots, fading out towards the edges of the panel. */
const DOTS = {
  backgroundImage: "radial-gradient(hsl(0 0% 100% / 0.09) 1px, transparent 1.5px)",
  backgroundSize: "24px 24px",
  maskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 35%, transparent 100%)",
  WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 35%, transparent 100%)",
} as const;

/** The panel the path is drawn on: the app's card and a grid of dots. */
export function RoadmapBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="card-3d relative overflow-hidden px-3 py-10 sm:px-8 sm:py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={DOTS} />
      <div className="relative">{children}</div>
    </div>
  );
}
