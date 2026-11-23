/**
 * The prompts a member pastes into Base44 (the AI app builder that builds and hosts their app) or into
 * ChatGPT for its logo, filled with their project: shown in the roadmap's steps
 * (shared/roadmap-missions.ts) and in what Gus knows (server/coach/context.ts). Written
 * here, not by a model: the same for every member, only the project changes, and they must be right
 * the first time.
 */

/** What the prompts say about the member's project. */
export type MissionProject = {
  name: string;
  /** What the app does, in one sentence (saas.description). */
  description: string | null;
  /** Who it is for (saas.audience). */
  audience: string | null;
  /** From the idea kept on /lancement, when the SaaS comes from one. */
  problem: string | null;
  /** Monthly price advised with the idea, in euros. */
  price: number | null;
  /** Public address of the SaaS's logo (saas.logo_url), once added: Base44 takes it from there. */
  logoUrl?: string | null;
};

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const offerOf = (project: MissionProject) =>
  project.price ? `un abonnement à ${euros.format(project.price)} par mois` : "un abonnement mensuel";

/** What the project is about, one line each; empty for a SaaS created by its name only. */
const aboutOf = (project: MissionProject) =>
  [
    project.description && `L'idée : ${project.description}`,
    project.problem && `Le problème qu'elle règle : ${project.problem}`,
    project.audience && `Pour qui : ${project.audience}`,
  ].filter((line): line is string => !!line);

/**
 * For Base44: builds the first version, up to the result screen, with the logo made in the style stage
 * (its public address, when the SaaS has it) and its colors.
 */
export function buildAppPrompt(project: MissionProject): string {
  const about = aboutOf(project);
  const offer = offerOf(project);
  const logo = project.logoUrl
    ? `- Mon logo est cette image : ${project.logoUrl}. Mets-le en haut de l'app et en icône de l'app.`
    : "- Mets le nom de l'app en haut, dans un style simple : j'ajouterai mon logo plus tard.";

  return [
    `Crée une app web appelée ${project.name}, pensée d'abord pour le téléphone.`,
    ...(about.length ? ["", ...about] : []),
    "",
    "Le parcours :",
    "1. L'utilisateur répond à quelques questions d'accueil, une par écran.",
    "2. L'app lui donne un résultat personnalisé, clair et beau.",
    `3. Plus tard, ${offer} débloquera la suite : n'ajoute pas encore le paiement.`,
    "",
    "Son style :",
    logo,
    `- Prends les couleurs ${project.logoUrl ? "de mon logo" : "qui parlent à mon public"} pour toute l'app, avec une police moderne et bien lisible : elle doit avoir l'air d'une vraie app.`,
    "",
    "Pas de connexion obligatoire : tout le monde doit pouvoir faire le parcours jusqu'au résultat.",
  ].join("\n");
}

/** For Base44: adds the subscription screen, its button opening the member's Whop payment page. */
export function buildPaymentPrompt(project: MissionProject): string {
  return [
    `Ajoute à ${project.name} un écran d'abonnement, juste après l'écran de résultat.`,
    `Il présente l'offre (${offerOf(project)}) et ce qu'elle débloque, avec un bouton « S'abonner » qui ouvre ma page de paiement Whop dans un nouvel onglet : [COLLE TON LIEN DE PAIEMENT ICI]`,
    "Garde le même style que le reste de l'app.",
  ].join("\n");
}

/** For ChatGPT: the app's logo, made to be an app icon (added to the SaaS, then given to Base44, whose app takes its colors). */
export function buildLogoPrompt(project: MissionProject): string {
  const about = aboutOf(project);
  return [
    `Je lance une app appelée ${project.name}.`,
    ...(about.length ? ["", ...about] : []),
    "",
    "Génère son logo :",
    "- Une icône d'app carrée, comme sur l'écran d'accueil d'un téléphone : une couleur franche, qui parle à mon public, remplit tout le fond, sans coins arrondis ni bordure.",
    "- Un seul symbole simple et reconnaissable au centre, qui évoque ce que fait l'app, sans aucun texte ni lettre.",
    "- Deux ou trois couleurs en aplats, sans petits détails : il doit rester lisible en tout petit.",
    "- De la marge autour du symbole : il doit tenir dans un cercle, pour la photo de profil TikTok.",
    "- Format carré, 1024 × 1024 pixels.",
  ].join("\n");
}

/** The prompts of the roadmap's steps (their "chatgpt" and "copy" buttons, shared/roadmap.ts). */
export type MissionPrompt = "logo" | "app" | "payment";

/** Where each prompt gets pasted. */
export const PROMPT_TARGET: Record<MissionPrompt, "Base44" | "ChatGPT"> = {
  logo: "ChatGPT",
  app: "Base44",
  payment: "Base44",
};

export function missionPromptText(prompt: MissionPrompt, project: MissionProject): string {
  switch (prompt) {
    case "logo":
      return buildLogoPrompt(project);
    case "app":
      return buildAppPrompt(project);
    case "payment":
      return buildPaymentPrompt(project);
  }
}

/** Opens ChatGPT on a new discussion with this prompt already written. */
export const chatGptUrl = (text: string) => `https://chatgpt.com/?q=${encodeURIComponent(text)}`;
