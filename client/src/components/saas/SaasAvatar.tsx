import { useState } from "react";
import { cn } from "@/lib/utils";

// Tile colors, picked from the SaaS id so each SaaS keeps its own. Full class names: Tailwind only
// generates the classes it finds written out.
const GRADIENTS = [
  "from-orange-400 to-orange-600",
  "from-violet-400 to-violet-600",
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-pink-400 to-rose-600",
  "from-amber-300 to-amber-500",
  "from-cyan-400 to-teal-600",
  "from-indigo-400 to-indigo-600",
] as const;

function gradientFor(seed: string | undefined) {
  if (!seed) return GRADIENTS[0];
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/** "Cal AI" → "CA", "Notion" → "N". */
export function saasInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase() || "S";
}

/**
 * The SaaS's tile: its logo when it has one (on white, whole), its initials on a gradient chosen from
 * its id otherwise (orange while it has no id, in the creation dialog), and also when the logo fails
 * to load. Size and radius come from `className` (e.g. "size-9 rounded-[10px] text-sm").
 */
export function SaasAvatar({
  name,
  seed,
  logoUrl,
  className,
}: {
  name: string;
  seed?: string;
  logoUrl?: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <span aria-hidden className={cn("flex shrink-0 select-none items-center justify-center overflow-hidden bg-white", className)}>
        <img
          src={logoUrl}
          alt=""
          draggable={false}
          className="size-full object-contain"
          onError={() => setFailedUrl(logoUrl)}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center bg-gradient-to-br font-semibold text-white",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.12)]",
        gradientFor(seed),
        className,
      )}
    >
      {saasInitials(name)}
    </span>
  );
}
