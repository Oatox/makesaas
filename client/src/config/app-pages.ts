import { ChartColumn, Clapperboard, Gauge, House, Route, TrendingUp, type LucideIcon } from "lucide-react";

export type AppPage = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: boolean;
  /** What the page is for, in one line: how Gus presents it at the end of /lancement (AppTour). */
  tour?: string;
  /** Sub-pages listed under the link, which then unfolds them instead of being a plain link. */
  children?: { href: string; label: string; icon?: LucideIcon }[];
};

/**
 * The pages of the app, in the order of the sidebar's "Application" category (AppSidebar) and of
 * Gus's tour of the app on /lancement: adding, renaming or describing a page here changes both.
 */
export const APP_PAGES: AppPage[] = [
  { href: "/accueil", label: "Accueil", icon: House, tour: "Tes tâches du jour, une par une, avec le bouton pour chaque étape." },
  { href: "/roadmap", label: "Roadmap", icon: Route, tour: "Ton chemin jusqu'à ton objectif : chaque palier se coche tout seul." },
  { href: "/dash", label: "Tableau de bord", icon: Gauge, matchPrefix: true, tour: "Tes revenus et ton MRR, dès que ton app encaisse." },
  {
    href: "/acquisition",
    label: "Acquisition",
    icon: TrendingUp,
    matchPrefix: true,
    tour: "Tes stats TikTok et tes carrousels, pour faire venir tes clients.",
    children: [
      { href: "/acquisition", label: "Statistiques", icon: ChartColumn },
      { href: "/acquisition/contenu", label: "Création de contenu", icon: Clapperboard },
    ],
  },
];
