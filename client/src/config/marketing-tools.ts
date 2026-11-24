import { Disc3, Rocket, type LucideIcon } from "lucide-react";

/**
 * Marketing tools of the admin (/admin/marketing): each one opens at /admin/marketing/<id>.
 * A tool is a standalone page under client/public/tools, embedded in an iframe. To add one, drop its
 * files there and add an entry here. Inside the tool, posting { type: "marketing-tool:home" } to the
 * parent window (e.g. on Escape) brings the admin back to the list.
 */
export type MarketingTool = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Page of the tool, under client/public (bump `v` when its files change: they can be cached). */
  src: string;
};

export const MARKETING_TOOLS: MarketingTool[] = [
  {
    id: "roulette",
    title: "La roue du destin",
    description: "Une roue (ou un rouleau) à faire tourner en live ou en vidéo. Résultat imposable en secret.",
    icon: Disc3,
    src: "/tools/roulette/index.html?mode=wheel&v=1",
  },
  {
    id: "onboarding",
    title: "Le faux onboarding",
    description:
      "Passions, temps, banque et objectif, puis le site qui se crée sous tes yeux et les paiements qui tombent. À filmer : araignée sur l'écran (A), écran tourné comme un téléphone (T).",
    icon: Rocket,
    src: "/tools/onboarding/index.html?v=10",
  },
];

export const getMarketingTool = (id: string) => MARKETING_TOOLS.find((tool) => tool.id === id);
