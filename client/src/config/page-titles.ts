// Single source for page names: used for the browser tab title and the app header.
const TITLE_BY_PATH: Record<string, string> = {
  "/": "Lancez votre SaaS",
  "/login": "Connexion",
  "/register": "Inscription",
  "/onboarding": "Bienvenue",
  "/abonnement": "Abonnement",
  "/app": "Tableau de bord",
  "/settings": "Paramètres",
  "/admin": "Aperçu admin",
  "/admin/users": "Utilisateurs",
  "/admin/pipeline": "Pipeline IA",
  "/mentions-legales": "Mentions légales",
  "/cgu": "CGU",
  "/cgv": "CGV",
  "/confidentialite": "Confidentialité",
};

export function getPageTitle(location: string): string | undefined {
  if (location.startsWith("/admin/users/")) return "Détail utilisateur";
  return TITLE_BY_PATH[location];
}

/** History state a link can set so the sub-page's back arrow returns where the user came from. */
export type BackState = { backTo?: string } | null;

// Sub-pages get a back arrow next to the sidebar trigger, pointing to the page they were opened
// from (link state), or to their default parent page.
export function getBackHref(location: string, state?: BackState): string | undefined {
  if (location.startsWith("/admin/users/")) return state?.backTo ?? "/admin/users";
  return undefined;
}
