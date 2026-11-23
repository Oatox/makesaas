import type { CSSProperties } from "react";
import { SiInstagram, SiTiktok } from "react-icons/si";
import { cn } from "@/lib/utils";

/** Social platforms shown in the acquisition page (Instagram: logo only, not connected yet). */
export type Platform = "tiktok" | "instagram";

const NAMES: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram" };

// Same raised tile as the payment providers' (revenue/providers.tsx): light from the top, darker edge.
const raised = (edge: string) => `inset 0 1px 0 hsl(0 0% 100% / 0.3), inset 0 -2px 0 ${edge}`;

const TILE_STYLES: Record<Platform, CSSProperties> = {
  tiktok: {
    backgroundImage: "linear-gradient(to bottom, #2a2a2e, #050505)",
    boxShadow: raised("#000"),
  },
  // Instagram's own gradient, from its yellow corner to its violet one.
  instagram: {
    backgroundImage: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)",
    boxShadow: raised("rgb(0 0 0 / 0.25)"),
  },
};

/** TikTok's note with its cyan and red echoes, as on its icon. */
function TikTokMark() {
  return (
    <span className="relative h-[54%] w-[54%]">
      <SiTiktok className="absolute inset-0 size-full -translate-x-[5%] -translate-y-[4%] text-[#25f4ee]" />
      <SiTiktok className="absolute inset-0 size-full translate-x-[5%] translate-y-[4%] text-[#fe2c55]" />
      <SiTiktok className="relative size-full text-white" />
    </span>
  );
}

/** The platform's logo on a tile of its brand colors. Size and corners by `className`. */
export function PlatformTile({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span
      role="img"
      aria-label={NAMES[platform]}
      className={cn("flex shrink-0 items-center justify-center text-white", className ?? "h-10 w-10 rounded-[11px]")}
      style={TILE_STYLES[platform]}
    >
      {platform === "tiktok" ? <TikTokMark /> : <SiInstagram className="h-[52%] w-[52%]" />}
    </span>
  );
}
