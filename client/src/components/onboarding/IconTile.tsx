import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// A raised orange tile, same 3D recipe as the buttons (.btn-3d in index.css): lighter top, light
// rim along the top, darker edge underneath for the thickness, an orange glow below.
const tileStyle = (edge: number, glow: number): CSSProperties => ({
  backgroundImage: "linear-gradient(to bottom, color-mix(in oklab, hsl(var(--primary)), white 22%), hsl(var(--primary)))",
  boxShadow: [
    "inset 0 1px 0 hsl(0 0% 100% / 0.45)",
    `inset 0 -${Math.ceil(edge / 2)}px 0 color-mix(in oklab, hsl(var(--primary)), black 30%)`,
    `0 ${edge}px 0 color-mix(in oklab, hsl(var(--primary)), black 52%)`,
    `0 ${glow}px ${glow * 2}px -${glow / 2}px hsl(var(--primary) / 0.55)`,
  ].join(", "),
});

const SIZES = {
  // A screen's icon, above its title.
  lg: {
    tile: "h-[84px] w-[84px] rounded-[26px] md:h-24 md:w-24 md:rounded-[30px]",
    icon: "h-10 w-10 md:h-11 md:w-11",
    style: tileStyle(6, 26),
  },
};

/** An icon on a raised orange tile, white with a light shadow, a gloss on the upper half. */
export function IconTile({ icon: Icon, size = "lg" }: { icon: LucideIcon; size?: keyof typeof SIZES }) {
  const { tile, icon, style } = SIZES[size];
  return (
    <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center overflow-hidden", tile)} style={style}>
      <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
      <Icon className={cn("relative text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]", icon)} strokeWidth={2} />
    </span>
  );
}
