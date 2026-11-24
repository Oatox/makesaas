/**
 * The prompts a member pastes into Base44 (the AI app builder that builds and hosts their app) or into
 * ChatGPT for its logo, filled with their project: shown in the roadmap's steps
 * (shared/roadmap-missions.ts) and in what Gus knows (server/coach/context.ts). Written
 * here, not by a model: the same for every member, only the project changes, and they must be right
 * the first time.
 *
 * Base44 builds the whole app from them, one part per task and in this order, each in the same chat:
 * the app and its home page (landing, the first prompt, which creates the app), accounts (login,
 * settings, plan, admin), onboarding (questions, then the paywall, before the sign-up), the core (its
 * main feature, for Pro users), a review of the whole app before publishing, then payment. Each says
 * what exists already and asks only for its part.
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
  /**
   * Its main feature, from the idea kept: what the user gives and what the app gives back. Absent for
   * a SaaS created by its name, or from an idea written before ideas had one.
   */
  feature?: string | null;
  /** Monthly price advised with the idea, in euros. */
  price: number | null;
  /** Public address of the SaaS's logo (saas.logo_url), once added: Base44 takes it from there. */
  logoUrl?: string | null;
  /** The Whop payment link of the app (saas.payment_link), once given in its task: the payment prompt carries it. */
  paymentLink?: string | null;
};

/** 9,99 € (the idea's consumer price), 9 € for the whole prices of older ideas. */
const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

const offerOf = (project: MissionProject) =>
  project.price ? `un abonnement à ${euros.format(project.price)} par mois` : "un abonnement mensuel";

/** The Pro plan, as the prompts name it. */
const proOf = (project: MissionProject) =>
  project.price ? `l'offre Pro à ${euros.format(project.price)} par mois` : "l'offre Pro, un abonnement mensuel";

/** What a subscriber pays, inside a sentence: "son abonnement (9,99 € par mois)". */
const subscriptionOf = (project: MissionProject) =>
  project.price ? `son abonnement (${euros.format(project.price)} par mois)` : "son abonnement";

/** What the project is about, one line each; empty for a SaaS created by its name only. */
const aboutOf = (project: MissionProject) =>
  [
    project.description && `L'idée : ${project.description}`,
    project.feature && `Sa fonctionnalité principale : ${project.feature}`,
    project.problem && `Le problème qu'elle règle : ${project.problem}`,
    project.audience && `Pour qui : ${project.audience}`,
  ].filter((line): line is string => !!line);

/** A text without its final full stop, to put inside a sentence. */
const clause = (text: string) => text.replace(/[.!?…]+$/, "");

/** What the app does, for the prompts after the first: its main feature, else its pitch. */
const coreOf = (project: MissionProject) => project.feature ?? project.description;

const MOBILE_FIRST = "Pensé d'abord pour le téléphone, dans le style du reste de l'app.";

/** One voice for the whole app: the onboarding speaks "tu", so everything else does too. */
const TONE =
  "Le ton : l'app tutoie l'utilisateur, partout et toujours (page d'accueil, questions, connexion, e-mails, espace connecté), avec des phrases simples et chaleureuses.";

/**
 * MakeSaaS's SaaS template, live on Base44 (the base44-saas-boilerplate project, on our Base44
 * account): the prompts give it to Base44 as a layout reference (home page, login pages), never to
 * copy its texts or colors. Keep it online.
 */
export const LAYOUT_REFERENCE_URL = "https://saas-boilerplate-0bbac609.base44.app";

/**
 * OneShotAPI, the one API for every AI model (text, images, video, voice): the core prompt has Base44
 * call it for whatever the app needs, from a server function, with the member's own key (their
 * account, their credits), and walk the member through getting that key.
 */
export const ONESHOT_URL = "https://oneshotapi.com";
export const ONESHOT_KEYS_URL = "https://oneshotapi.com/keys";
const ONESHOT_API_BASE = "https://api.oneshotapi.com";
/** OneShotAPI's docs for AI agents (Markdown pages, OpenAPI and the model catalog). */
const ONESHOT_DOCS_FOR_AI = "https://oneshotapi.com/llms.txt";

/**
 * For Base44, the first prompt, which creates the app: its project, its style (the logo made in the
 * style stage, when the SaaS has it, and its colors) and its public home page with the legal pages,
 * without a pricing section. The rest comes with the next prompts.
 */
export function buildLandingPrompt(project: MissionProject): string {
  const about = aboutOf(project);
  const publicOf = project.audience ? "ce public" : "mon public";
  const logo = project.logoUrl
    ? `- Mon logo est cette image : ${project.logoUrl}. Importe-la dans les fichiers de l'app et utilise ta copie (ce lien peut changer), dans l'en-tête et en icône de l'app.`
    : "- Mets le nom de l'app dans l'en-tête, dans un style simple : j'ajouterai mon logo plus tard.";

  return [
    `Crée une app web appelée ${project.name}, pensée d'abord pour le téléphone, avec tous ses textes en français.`,
    ...(about.length ? ["", ...about] : []),
    "",
    TONE,
    "",
    "Je la construis en plusieurs étapes. Pour celle-ci, fais seulement sa page d'accueil, ouverte à tous sans compte :",
    "1. En-tête : le logo et le nom à gauche, un bouton « Commencer » à droite. Il reste visible quand on fait défiler la page, et tient sur une seule ligne sur téléphone.",
    "2. Haut de page : un titre qui promet le résultat en une phrase, un sous-titre qui dit pour qui c'est et comment ça marche, le bouton « Commencer », et dessous un aperçu de l'écran principal de l'app dans un téléphone.",
    `3. Le problème : 3 situations que vit ${publicOf}, dites avec ses mots.`,
    "4. Comment ça marche : 3 étapes : répondre à quelques questions, recevoir son résultat personnalisé, puis s'en servir au quotidien.",
    "5. Fonctionnalités : 6 cartes concrètes, chacune avec une icône et une phrase.",
    `6. Questions fréquentes : 5 questions que se pose ${publicOf}, en accordéon.`,
    "7. Un dernier appel à l'action avec le bouton « Commencer », puis un pied de page avec les liens Mentions légales, CGU et Politique de confidentialité.",
    "8. Ces trois pages légales : des textes types, avec [À COMPLÉTER] partout où il faut mes informations (nom, adresse, e-mail). L'hébergeur est Base44.",
    "9. Une page introuvable (404) en français, avec un bouton pour revenir à l'accueil.",
    `10. Référencement : la langue des pages est le français (lang="fr"), chaque page a son titre d'onglet (« Nom de la page · ${project.name} ») et sa description, et l'app a une image d'aperçu pour les partages de lien.`,
    "",
    "Pour l'instant, les boutons « Commencer » mènent à une page /commencer qui affiche « Bientôt disponible » : je la construis juste après.",
    "",
    "Son style :",
    `- Pour la mise en page, inspire-toi de ce modèle : ${LAYOUT_REFERENCE_URL} (en-tête, enchaînement des sections, espacements, cartes, pied de page). N'en reprends ni les textes ni les couleurs.`,
    logo,
    `- Prends les couleurs ${project.logoUrl ? "de mon logo" : "qui parlent à mon public"} pour toute l'app, avec une police moderne et bien lisible et beaucoup d'espace : elle doit avoir l'air d'une vraie app, pas d'une maquette.`,
  ].join("\n");
}

/**
 * For Base44: accounts (Base44's login pages, in French, with Google), what stays public, the signed-in
 * space and its menu, settings with account deletion, the Pro plan as a user field only admins
 * change, and the member's admin page, where they turn buyers Pro.
 */
export function buildAccountsPrompt(project: MissionProject): string {
  return [
    `Ajoute à ${project.name} les comptes utilisateurs. Tous les textes restent en français et tutoient l'utilisateur, comme le reste de l'app.`,
    "",
    `1. Connexion : mets en place les pages de connexion de Base44 : connexion, inscription avec le code de vérification envoyé par e-mail, mot de passe oublié et nouveau mot de passe. Propose la connexion avec Google en plus de l'e-mail, et habille ces pages aux couleurs de l'app, avec son logo et leur titre d'onglet (« Connexion · ${project.name} »…). Pour leur mise en page, inspire-toi de ${LAYOUT_REFERENCE_URL}/login (le formulaire à gauche, l'app présentée à droite sur ordinateur). Sous le bouton d'inscription : « En créant ton compte, tu acceptes les CGU et la politique de confidentialité », avec leurs liens.`,
    "2. Ce qui reste ouvert à tous : la page d'accueil, /commencer et les pages légales. Tout le reste demande d'être connecté : on passe par la connexion, puis on revient sur la page demandée.",
    "3. En-tête de la page d'accueil : ajoute « Se connecter » à côté de « Commencer ». Une fois connecté, ils laissent la place à « Ouvrir l'app ». Sur téléphone, il tient sur une seule ligne, sans texte coupé : « Se connecter » devient un petit lien discret.",
    "4. Espace connecté : une fois connecté, l'utilisateur arrive sur /app, avec un menu (une barre en bas sur téléphone, sur le côté sur ordinateur) : « Accueil », « Abonnement » et « Paramètres ». Pour l'instant, /app lui dit bonjour avec son prénom et « Ton espace arrive bientôt ».",
    "5. Paramètres : modifier son nom, se déconnecter, et supprimer son compte après confirmation (il tape SUPPRIMER). La suppression passe par une fonction serveur qui supprime l'utilisateur et ses données.",
    `6. Abonnement : ajoute aux utilisateurs un champ is_subscriber (non par défaut) que seuls les administrateurs peuvent modifier : personne ne peut se passer Pro lui-même. La page « Abonnement » montre s'il est Pro ou non (Gratuit, ou ${proOf(project)}) et ce que débloque Pro, avec un bouton « Passer à Pro » qui affiche « Bientôt disponible » pour l'instant : je branche le paiement plus tard. Sans Pro, l'app ne donne que l'aperçu de son résultat : ne présente pas Gratuit comme une offre avec des fonctionnalités.`,
    "7. Administration : une page « Administration », visible seulement par les administrateurs (dont moi), avec le nombre d'inscrits et d'abonnés Pro, puis la liste des utilisateurs (recherche par nom ou e-mail, date d'inscription, offre) et, pour chacun, un bouton « Passer en Pro » ou « Repasser en Gratuit ».",
    "",
    MOBILE_FIRST,
  ].join("\n");
}

/**
 * For Base44: the onboarding, open to all without an account: questions, then the paywall (the
 * result partly blurred above the Pro offer), whose button leads to the sign-up, then to the plan.
 * The answers follow the user into their account.
 */
export function buildOnboardingPrompt(project: MissionProject): string {
  const core = coreOf(project);
  return [
    `Construis maintenant le parcours d'accueil de ${project.name} sur la page /commencer, ouverte à tous sans compte : c'est là que mènent les boutons « Commencer ». Il se termine par l'écran d'abonnement (le paywall).`,
    "",
    `1. Questions : 5 à 7 questions pour connaître l'utilisateur avant de lui préparer son résultat${core ? ` (${project.name} : ${clause(core)})` : ""}. Une question par écran, avec de grosses réponses à toucher du doigt (un choix, plusieurs choix ou un curseur selon la question), une barre de progression et un bouton retour. Garde les réponses dans le navigateur pour ne rien perdre en route.`,
    "2. Préparation : après la dernière question, quelques secondes d'animation « On prépare ton résultat… », qui montre ce que l'app prend en compte.",
    `3. Paywall : juste après, un écran d'abonnement en plein écran. En haut, l'aperçu de son résultat personnalisé à partir de ses réponses : les premières lignes sont lisibles et donnent envie, la suite est floutée. Dessous, ${proOf(project)}, 4 avantages concrets tirés de ses réponses, « Annulable à tout moment », et un gros bouton « Débloquer mon résultat ». Sur téléphone, ce bouton reste visible en bas de l'écran, sans avoir à faire défiler.`,
    "4. La partie floutée n'est qu'un aperçu : le vrai résultat complet n'est jamais dans la page (ni lisible en sélectionnant le texte) tant que l'utilisateur n'est pas Pro.",
    "5. Relis les phrases construites à partir des réponses : elles doivent être correctes quelle que soit la réponse (accords, articles : « ta musculation », pas « ton musculation »).",
    "6. Le bouton « Débloquer mon résultat » mène à l'inscription s'il n'a pas encore de compte, puis à la page Abonnement. Le paiement sera branché plus tard : pour l'instant, la page Abonnement affiche « Bientôt disponible ».",
    "7. Après l'inscription : enregistre ses réponses sur son compte (un champ onboarding_answers sur l'utilisateur), puis efface-les du navigateur. Sur /app, tant qu'il n'est pas Pro, il retrouve l'aperçu flouté de son résultat et le bouton « Débloquer mon résultat ».",
    "",
    MOBILE_FIRST,
  ].join("\n");
}

/**
 * For Base44: the core of the app, in the signed-in space: its main feature (what the user gives →
 * what the app gives back, used again and again), reserved to the Pro plan, with the onboarding's
 * full result under it. A first app built with the former version turned the core into the
 * onboarding's questions again, with a "posture score" made up from answers: hence the main feature
 * first, and nothing shown that the app did not really compute. Each OneShotAPI call costs the member
 * credits: a daily limit per user keeps a subscriber who reaches it every day at a quarter of their
 * subscription at most.
 */
export function buildAppPrompt(project: MissionProject): string {
  const core = coreOf(project);
  return [
    `Construis maintenant le cœur de ${project.name} dans l'espace connecté, sa fonctionnalité principale${core ? ` : ${clause(core)}.` : ", celle que promet la page d'accueil."}`,
    "C'est ce que l'utilisateur vient faire encore et encore : le résultat du parcours d'accueil ne la remplace pas.",
    "",
    "1. Écran principal (/app) : la fonctionnalité principale, en premier et en grand. L'utilisateur donne ce qu'elle demande (une photo, une vidéo, un texte, des chiffres… ; un fichier se prend ou se choisit depuis son téléphone, avec un aperçu avant d'envoyer), suit la progression pendant que l'app travaille, puis reçoit son résultat, clair et beau. Il peut recommencer, dans la limite du jour quand elle passe par OneShotAPI (point 8).",
    "2. Son résultat du parcours d'accueil : en dessous, le résultat complet promis par le paywall, fait à partir de ses réponses, avec « Ajuster mes réponses ».",
    "3. Que du vrai : n'affiche jamais un score, une mesure ou un chiffre que l'app n'a pas vraiment calculé à partir de ce que l'utilisateur lui a donné. Si l'analyse échoue, dis-le-lui et propose de réessayer : ne fabrique jamais de résultat à la place.",
    "4. Données : garde chaque utilisation (ce qu'il a donné et le résultat), avec des règles d'accès : chacun ne voit et ne modifie que ses propres données.",
    "5. Historique : une page « Mes résultats », dans le menu, avec ses utilisations précédentes, de la plus récente à la plus ancienne, chacune s'ouvrant en entier.",
    "6. Accès : le résultat complet et la fonctionnalité principale sont réservés aux abonnés Pro (is_subscriber) et aux administrateurs. Les autres retrouvent le paywall du parcours d'accueil : l'aperçu flouté de leur résultat, l'offre Pro et le bouton « Débloquer mon résultat ». En tant qu'administrateur, j'ai accès à tout pour tester.",
    `7. IA et API : si l'app a besoin d'IA ou d'une API pour fabriquer le résultat (texte, analyse d'une photo ou d'une vidéo, image, voix…), utilise OneShotAPI, une seule API pour tous les modèles : ${ONESHOT_API_BASE}, avec l'en-tête « Authorization: Bearer », et sa documentation pour les IA : ${ONESHOT_DOCS_FOR_AI}. Appelle-la uniquement depuis une fonction serveur, qui vérifie d'abord que l'utilisateur est Pro, avec la clé rangée dans les secrets de l'app sous le nom ONESHOT_API_KEY, jamais dans le code de l'app.`,
    `8. Limites : chaque appel à OneShotAPI me coûte des crédits. Fixe une limite d'utilisations par jour et par utilisateur, vérifiée par la fonction serveur avant d'appeler OneShotAPI, pour qu'un abonné qui l'atteint chaque jour me coûte au plus un quart de ${subscriptionOf(project)} en crédits : calcule-la avec le prix des modèles utilisés (dans la documentation de OneShotAPI), puis dis-moi la limite choisie, ton calcul et où la changer. L'app annonce cette limite et montre ce qu'il reste aujourd'hui ; une fois atteinte, elle dit « Tu as atteint ta limite du jour, reviens demain » plutôt qu'une erreur. Nulle part l'app ne promet d'usage illimité.`,
    `9. Ma clé OneShotAPI : avant de coder cette partie, explique-moi simplement, étape par étape, comment l'obtenir : créer mon compte sur ${ONESHOT_URL}, ajouter des crédits, ouvrir « Clés API » (${ONESHOT_KEYS_URL}), créer une clé et la copier. Puis demande-la-moi dans les secrets de l'app (ONESHOT_API_KEY).`,
    "10. Pour finir, relis la page d'accueil, le paywall et la page Abonnement : tout ce qu'ils promettent, l'app le fait vraiment (retire le reste), et tous les textes de l'app tutoient l'utilisateur.",
    "",
    MOBILE_FIRST,
  ].join("\n");
}

/**
 * For Base44, before publishing: a review of the whole app against what the prompts before asked (the
 * journey, access, the main feature, texts, phones, SEO, legal pages), which Base44 fixes itself, then
 * a recap of what is left to the member. The payment comes after publishing: "Bientôt disponible" is
 * expected there.
 */
export function buildReviewPrompt(project: MissionProject): string {
  return [
    `Avant que je publie ${project.name}, passe toute l'app en revue, comme si tu étais un nouveau client, et corrige tout ce qui ne va pas :`,
    "",
    "1. Le parcours complet marche, sans bouton ni lien mort ni page blanche : page d'accueil, « Commencer », questions, paywall, inscription, page Abonnement, écran principal, historique, paramètres, connexion, mot de passe oublié, déconnexion et suppression du compte.",
    "2. Les accès : un visiteur ne voit rien de l'espace connecté ; sans Pro, on ne voit que l'aperçu flouté (le résultat complet n'est jamais dans la page) ; seul un administrateur voit l'Administration et peut changer is_subscriber ; chacun ne voit que ses propres données.",
    "3. La fonctionnalité principale marche de bout en bout et donne un vrai résultat. Si elle appelle OneShotAPI : la clé n'est que dans les secrets (ONESHOT_API_KEY), l'appel passe par une fonction serveur qui vérifie l'accès Pro et la limite du jour, et une erreur est expliquée à l'utilisateur.",
    "4. Les textes : tout est en français (pages, messages d'erreur, e-mails, page 404) et tutoie l'utilisateur, sans faute ni texte d'exemple oublié. Aucun faux avis, aucun faux chiffre (nombre d'utilisateurs, note), aucune promesse que l'app ne tient pas.",
    "5. Sur téléphone, chaque page s'affiche bien : rien de coupé ni qui dépasse, des boutons faciles à toucher.",
    `6. Le référencement : chaque page a son titre d'onglet (« Nom de la page · ${project.name} ») et sa description, la langue des pages est le français, l'icône et l'image d'aperçu sont celles de l'app.`,
    "7. Les pages légales : s'il reste des [À COMPLÉTER], demande-moi les informations qui manquent, puis complète-les.",
    "",
    "Le paiement n'est pas encore branché : « Bientôt disponible » sur la page Abonnement est normal, n'y touche pas.",
    "Quand tu as fini, fais-moi un récap court : ce que tu as corrigé, puis ce qui me reste à faire moi-même.",
  ].join("\n");
}

/**
 * Whop, where members sell their app's subscription (docs.whop.com, read 2026-11-24): an account "for
 * payment processing only", a product with its monthly plan, then, in the developer page, an Account
 * API key and a webhook. The payment tasks (shared/roadmap-missions.ts) open these pages.
 */
export const WHOP_SELL_URL = "https://whop.com/sell";
export const WHOP_DEVELOPER_URL = "https://whop.com/dashboard/developer";
const WHOP_API_BASE = "https://api.whop.com/api/v1";
/** Whop's docs written for coding agents: the first API call, a checkout, and its signed webhooks. */
const WHOP_DOCS_FOR_AI = ["https://docs.whop.com/developer/quickstart.md", "https://docs.whop.com/developer/guides/webhooks.md"];
/** Where a Whop buyer finds their subscriptions and cancels one (Profile → Orders). */
const WHOP_ORDERS_URL = "https://whop.com/@me/settings/orders/";
/** In the payment prompt until the member gives their Whop payment link (in the "Crée ta boutique Whop" task). */
export const PAYMENT_LINK_PLACEHOLDER = "[COLLE TON LIEN DE PAIEMENT ICI]";
/** Membership statuses that grant access (Whop's Membership.status): past_due is the grace period after a failed payment. */
const WHOP_ACCESS_STATUSES = "active, trialing, past_due ou completed";

/**
 * For Base44: the whole Whop layer. A checkout made by the server for the signed-in user (a checkout
 * configuration on the member's plan, carrying the user's id in its metadata, back to /app once paid),
 * then the signed `membership.updated` webhook (sent on activation and deactivation alike), which
 * re-reads the membership from Whop's API and turns `is_subscriber` on or off: nobody is turned Pro
 * by hand anymore (the admin page keeps it, to give access). Pro users manage and cancel on Whop,
 * which deleting their account does not do. Base44 walks the member through the API key at once; the
 * webhook is created on Whop once the app is published (its own task), and its secret added then.
 */
export function buildPaymentPrompt(project: MissionProject): string {
  return [
    `Branche les paiements de ${project.name} avec Whop, de bout en bout : l'utilisateur paie, et son compte passe Pro tout seul.`,
    "",
    `Mon offre sur Whop : ${offerOf(project)}. Son lien de paiement : ${project.paymentLink ?? PAYMENT_LINK_PLACEHOLDER}`,
    "L'identifiant de cette offre (plan_…) est dans ce lien ; s'il n'y est pas, demande-le-moi.",
    `L'API de Whop : ${WHOP_API_BASE}, avec l'en-tête « Authorization: Bearer », et sa documentation pour les IA : ${WHOP_DOCS_FOR_AI.join(" et ")}. Appelle-la uniquement depuis des fonctions serveur, avec ma clé rangée dans les secrets de l'app sous le nom WHOP_API_KEY, jamais dans le code de l'app.`,
    "",
    "1. Payer : « Débloquer mon résultat » (le paywall et l'écran principal) et « Passer à Pro » (la page Abonnement) appellent une fonction serveur qui crée un paiement Whop pour cet utilisateur : une checkout configuration sur mon offre, avec son identifiant d'utilisateur dans les metadata et un retour vers /app une fois payé. Puis l'app ouvre ce paiement. Un visiteur sans compte crée d'abord son compte, puis part directement au paiement. Un abonné Pro ne voit plus ces boutons.",
    `2. Passer Pro tout seul : une adresse publique de l'app reçoit les webhooks de Whop. Elle vérifie leur signature sur le corps brut de la requête avec le secret WHOP_WEBHOOK_SECRET (le ws_… tel quel) et refuse tout le reste. À chaque événement membership.updated (Whop l'envoie quand un abonnement commence, change ou s'arrête), elle relit cet abonnement auprès de l'API Whop, car un événement peut arriver en double ou dans le désordre. Elle retrouve l'utilisateur par les metadata (sinon par son e-mail), puis met is_subscriber à oui si le statut est ${WHOP_ACCESS_STATUSES}, et à non sinon. Elle garde aussi sur l'utilisateur l'identifiant de son abonnement et son lien de gestion (manage_url), que seuls les administrateurs et le serveur peuvent modifier. Elle répond en moins de 5 secondes.`,
    "3. Retour du paiement : sur /app, « Paiement reçu, on active ton accès… » s'affiche jusqu'à ce qu'il soit Pro (quelques secondes), puis son résultat complet.",
    `4. Gérer son abonnement : pour un abonné Pro, la page Abonnement a un lien « Gérer mon abonnement » vers son lien de gestion Whop (à défaut, ses commandes Whop : ${WHOP_ORDERS_URL}), où il l'annule. Dans Paramètres, avant la suppression du compte, il lit : « Annule d'abord ton abonnement sur Whop : supprimer ton compte ne l'arrête pas. », avec le même lien.`,
    "5. Administration : « Passer en Pro » reste là pour offrir l'accès à la main, et la liste montre quels abonnés Pro paient avec Whop.",
    `6. Ma clé Whop : avant de coder, explique-moi simplement, étape par étape, comment la créer : sur ${WHOP_DEVELOPER_URL}, dans Account API Keys, une clé avec seulement les permissions des appels que fait l'app (créer un paiement, lire un abonnement : dis-moi lesquelles cocher, d'après la documentation de Whop). Puis demande-la-moi dans les secrets de l'app (WHOP_API_KEY). Si Whop refuse un appel faute de permission, dis-moi laquelle ajouter.`,
    "7. Le webhook : à la fin, donne-moi l'adresse exacte de ton webhook, sur le domaine de mon app. Une fois l'app publiée, je le crée sur Whop (Create webhook, version v1, événement membership.updated), puis j'ajoute moi-même son secret dans les secrets de l'app sous le nom WHOP_WEBHOOK_SECRET : ne me le demande pas maintenant.",
    "",
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
export type MissionPrompt = "logo" | "landing" | "accounts" | "onboarding" | "app" | "review" | "payment";

/** Where each prompt gets pasted. */
export const PROMPT_TARGET: Record<MissionPrompt, "Base44" | "ChatGPT"> = {
  logo: "ChatGPT",
  landing: "Base44",
  accounts: "Base44",
  onboarding: "Base44",
  app: "Base44",
  review: "Base44",
  payment: "Base44",
};

export function missionPromptText(prompt: MissionPrompt, project: MissionProject): string {
  switch (prompt) {
    case "logo":
      return buildLogoPrompt(project);
    case "landing":
      return buildLandingPrompt(project);
    case "accounts":
      return buildAccountsPrompt(project);
    case "onboarding":
      return buildOnboardingPrompt(project);
    case "app":
      return buildAppPrompt(project);
    case "review":
      return buildReviewPrompt(project);
    case "payment":
      return buildPaymentPrompt(project);
  }
}

/** Opens ChatGPT on a new discussion with this prompt already written. */
export const chatGptUrl = (text: string) => `https://chatgpt.com/?q=${encodeURIComponent(text)}`;
