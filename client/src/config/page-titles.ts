import { getMarketingTool } from "@/config/marketing-tools";
import { getPipelineConfig } from "@/components/admin/pipeline/pipeline-steps";

// Single source for page names: used for the browser tab title and the app header.
const TITLE_BY_PATH: Record<string, string> = {
  "/": "Lancez votre SaaS",
  "/login": "Connexion",
  "/register": "Inscription",
  "/onboarding": "Bienvenue",
  "/abonnement": "Abonnement",
  "/lancement": "Ton idée",
  "/app": "Accueil",
  "/roadmap": "Roadmap",
  "/acquisition": "Statistiques",
  "/acquisition/contenu": "Création de contenu",
  "/discussions": "Discussions",
  "/settings": "Paramètres",
  "/admin": "Aperçu admin",
  "/admin/users": "Utilisateurs",
  "/admin/pipeline": "Pipelines IA",
  "/admin/marketing": "Marketing",
  "/mentions-legales": "Mentions légales",
  "/cgu": "CGU",
  "/cgv": "CGV",
  "/confidentialite": "Confidentialité",
};

export function getPageTitle(location: string): string | undefined {
  if (location.startsWith("/admin/users/")) return "Détail utilisateur";
  if (location.startsWith("/discussions/")) return "Discussions";
  if (location.startsWith("/acquisition/contenu/")) return "Création de contenu";
  if (location.startsWith("/admin/marketing/")) {
    return getMarketingTool(location.slice("/admin/marketing/".length))?.title ?? "Marketing";
  }
  if (location.startsWith("/admin/pipeline/")) {
    return getPipelineConfig(location.slice("/admin/pipeline/".length))?.label ?? "Pipelines IA";
  }
  return TITLE_BY_PATH[location];
}

/** History state a link can set so the sub-page's back arrow returns where the user came from. */
export type BackState = { backTo?: string } | null;

// Sub-pages get a back arrow next to the sidebar trigger, pointing to the page they were opened
// from (link state), or to their default parent page.
export function getBackHref(location: string, state?: BackState): string | undefined {
  if (location.startsWith("/admin/users/")) return state?.backTo ?? "/admin/users";
  if (location.startsWith("/admin/marketing/")) return "/admin/marketing";
  if (location.startsWith("/admin/pipeline/")) return "/admin/pipeline";
  return undefined;
}
