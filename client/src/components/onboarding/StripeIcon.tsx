import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// Stripe's purple, as a raised tile with the same 3D recipe as the buttons (.btn-3d in index.css):
// lighter top, light rim along the top, darker edge at the bottom.
const STRIPE_COLOR = "#635bff";
const TILE: CSSProperties = {
  backgroundImage: `linear-gradient(to bottom, color-mix(in oklab, ${STRIPE_COLOR}, white 20%), ${STRIPE_COLOR})`,
  boxShadow: [
    "inset 0 1px 0 hsl(0 0% 100% / 0.4)",
    `inset 0 -2px 0 color-mix(in oklab, ${STRIPE_COLOR}, black 32%)`,
    "0 3px 8px -2px rgb(0 0 0 / 0.6)",
  ].join(", "),
};

/** Stripe's app icon, for the payment notifications of the illustrations. Size, corners and letter size by `className`. */
export function StripeIcon({ className = "h-10 w-10 rounded-[11px] text-[21px]" }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center overflow-hidden", className)} style={TILE}>
      <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
      <span className="relative font-sans font-extrabold leading-none tracking-tight text-white">S</span>
    </span>
  );
}
