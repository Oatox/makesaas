/**
 * The prompts a member pastes into Claude (Claude Code, in the desktop app) to build their app, or into
 * ChatGPT for its logo, filled with their project: shown in the roadmap's tutorials
 * (shared/roadmap-missions.ts) and in Gus's
 * first mission (server/roadmap/first-mission.ts). Written here, not by a model: the same for every
 * member, only the project changes, and they must be right the first time.
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

/** Builds the first version, up to the result screen, in the colors of the logo made in the style stage. */
export function buildAppPrompt(project: MissionProject): string {
  const about = aboutOf(project);
  const offer = offerOf(project);

  return [
    `Je veux créer une app web appelée ${project.name}. Je ne sais pas coder : explique-moi chaque étape simplement.`,
    ...(about.length ? ["", ...about] : []),
    "",
    "Comment elle marche :",
    "- L'utilisateur répond à quelques questions d'accueil.",
    "- L'app lui donne un résultat personnalisé.",
    `- ${offer.charAt(0).toUpperCase()}${offer.slice(1)} débloque la suite.`,
    "",
    "Son style :",
    "- Mon logo est le fichier logo.png de ce dossier : mets-le en haut de l'app, en icône de l'onglet du navigateur, et en icône quand on ajoute l'app à l'écran d'accueil du téléphone.",
    "- Prends les couleurs de mon logo pour toute l'app, avec une police moderne et bien lisible : elle doit avoir l'air d'une vraie app.",
    "",
    "Ce que je te demande :",
    "1. Pose-moi d'abord les questions qui te manquent pour bien comprendre l'app, une à la fois.",
    "2. Écris ensuite le cahier des charges dans un fichier SPEC.md.",
    "3. Construis une première version qui marche jusqu'à l'écran de résultat, belle sur téléphone et fidèle à mon style, sans le paiement pour l'instant.",
    "4. Ouvre-la dans l'aperçu et vérifie toi-même tout le parcours avant de me la montrer.",
  ].join("\n");
}

/** Adds the subscription screen, its button opening the member's Whop payment page. */
export function buildPaymentPrompt(project: MissionProject): string {
  return [
    `Ajoute à ${project.name} un écran d'abonnement, juste après l'écran de résultat.`,
    `Il présente l'offre (${offerOf(project)}) et ce qu'elle débloque, avec un bouton qui ouvre ma page de paiement Whop : [COLLE TON LIEN DE PAIEMENT ICI]`,
    "Garde le même style que le reste de l'app, vérifie dans l'aperçu que le bouton ouvre bien la page de paiement, puis republie l'app.",
  ].join("\n");
}

/** For ChatGPT: the app's logo, made to be an app icon (logo.png for the build, whose colors the app takes). */
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

/** Publishes the app for free and gives back its address (the member then pastes it in its step). */
export function buildOnlinePrompt(project: MissionProject): string {
  return [
    `Mets ${project.name} en ligne gratuitement avec Netlify.`,
    "Guide-moi étape par étape, je ne sais pas coder. À la fin, donne-moi l'adresse de l'app et vérifie qu'elle s'ouvre bien sur téléphone.",
  ].join("\n");
}

/** The prompts of the roadmap's steps (their "chatgpt" and "copy" buttons, shared/roadmap.ts). */
export type MissionPrompt = "logo" | "app" | "online" | "payment";

/** Where each prompt gets pasted. */
export const PROMPT_TARGET: Record<MissionPrompt, "Claude" | "ChatGPT"> = {
  logo: "ChatGPT",
  app: "Claude",
  online: "Claude",
  payment: "Claude",
};

export function missionPromptText(prompt: MissionPrompt, project: MissionProject): string {
  switch (prompt) {
    case "logo":
      return buildLogoPrompt(project);
    case "app":
      return buildAppPrompt(project);
    case "online":
      return buildOnlinePrompt(project);
    case "payment":
      return buildPaymentPrompt(project);
  }
}

/** Opens ChatGPT on a new discussion with this prompt already written. */
export const chatGptUrl = (text: string) => `https://chatgpt.com/?q=${encodeURIComponent(text)}`;
