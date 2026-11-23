/**
 * The prompts a member pastes into Claude (Claude Code, in the desktop app) to build their app, filled
 * with their project: shown in the roadmap's tutorials (shared/roadmap-missions.ts) and in Gus's
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

/** Builds the first version, up to the result screen. */
export function buildAppPrompt(project: MissionProject): string {
  const about = [
    project.description && `L'idée : ${project.description}`,
    project.problem && `Le problème qu'elle règle : ${project.problem}`,
    project.audience && `Pour qui : ${project.audience}`,
  ].filter(Boolean);
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
    "Ce que je te demande :",
    "1. Pose-moi d'abord les questions qui te manquent pour bien comprendre l'app, une à la fois.",
    "2. Écris ensuite le cahier des charges dans un fichier SPEC.md.",
    "3. Construis une première version qui marche jusqu'à l'écran de résultat, belle sur téléphone, sans le paiement pour l'instant.",
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
