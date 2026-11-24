import { MRR_TIERS, monthlyGoalOf, type Milestone, type MissionDone, type RoadmapMission, type RoadmapStage, type StepAction } from "./roadmap";
import { ONESHOT_KEYS_URL, WHOP_DEVELOPER_URL, WHOP_SELL_URL } from "./roadmap-prompts";

/**
 * The content of the roadmap: its stages, their missions and each mission's steps (shared/roadmap.ts
 * says how they work). The member goes through a mission one step at a time, so keep every step to one
 * short sentence starting with a verb, in everyday words, with at most one button. Edit the texts
 * freely; keep the keys: done missions are saved by key.
 */

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Base44's sign-up page, where members build their app: our referral link, which gives them 30 free
 * credits. The "Créer mon compte Base44" button of its task opens it.
 */
export const BASE44_URL = "https://app.base44.com/register?ref=A3KZZ2DZZ85WHDJB&source=referral_program";

/**
 * Base44's plans: the "Crée ton compte Base44" task advises Builder from the start (more credits to
 * build the app; like every paid plan, a domain bought in Base44, free the first year when billed
 * yearly), since "Achète ton nom de domaine dans Base44" buys it there ("Buy new domain", registered by Wix).
 */
const BASE44_PRICING_URL = "https://base44.com/pricing";

/**
 * The build tasks before the core of the app. The app used to be built with a single prompt, in the
 * task now named "Construis le cœur de ton app" (build:first_version): members who did it then have
 * these done (withEarlierBuildMissions in server/roadmap/service.ts).
 */
export const EARLIER_BUILD_MISSIONS = ["build:landing", "build:accounts", "build:onboarding"] as const;

/**
 * Tasks added to the launch after members had gone past them: done once the task after them is
 * (withEarlierBuildMissions), so that nobody who already published goes back to them.
 */
export const LATER_ADDED_MISSIONS: Record<string, string> = { "build:review": "build:online", "payment:webhook": "payment:test" };

const STATS: StepAction = { kind: "page", label: "Ouvrir mes statistiques", href: "/acquisition" };
const CONTENT: StepAction = { kind: "page", label: "Créer un carrousel", href: "/acquisition/contenu" };
const REVENUE: StepAction = { kind: "page", label: "Voir mes revenus", href: "/dash" };

/** The stages every member goes through before the MRR ones. */
const BASE_STAGES: RoadmapStage[] = [
  {
    key: "idea",
    title: "Ton idée",
    label: "Ton idée",
    detail: "Tu sais ce que tu construis, et pour qui.",
    missions: [
      {
        key: "idea:chosen",
        title: "Choisis ton idée",
        why: "Tout part de là : une app simple, pour un public précis.",
        minutes: 5,
        steps: [{ text: "Garde une des idées que Gus t'a proposées : c'est ton projet." }],
        check: { kind: "saas" },
      },
    ],
  },
  {
    key: "brand",
    title: "Donne un style à ton SaaS",
    label: "Ton style",
    detail: "Ton SaaS a son logo : dès sa première version, il a l'air pro.",
    missions: [
      {
        key: "brand:logo",
        title: "Crée ton logo",
        why: "On le voit partout : sur ton app, sur ton TikTok, sur l'écran du téléphone.",
        minutes: 5,
        steps: [
          { text: "Demande ton logo à ChatGPT.", action: { kind: "chatgpt", prompt: "logo" } },
          { text: "Pas convaincu ? Demande-lui une autre version. Quand il te plaît, télécharge l'image." },
          { text: "Ajoute ton logo à ton projet.", action: { kind: "settings", tab: "general", label: "Ajouter mon logo" } },
        ],
        check: { kind: "logo" },
      },
    ],
  },
  {
    key: "build",
    title: "Construis ton SaaS",
    label: "App en ligne",
    detail: "Ton app marche et tout le monde peut l'ouvrir, sans que tu aies écrit une ligne de code.",
    missions: [
      {
        // The key comes from when the app was built with Claude: kept, done missions are saved by key.
        key: "build:claude",
        title: "Crée ton compte Base44",
        why: "Base44 construit ton app pendant que tu la décris, et l'héberge pour toi.",
        minutes: 2,
        steps: [
          { text: "Crée ton compte Base44 avec ce lien : tu reçois 30 crédits offerts pour commencer.", action: { kind: "open", label: "Créer mon compte Base44", url: BASE44_URL } },
          {
            text: "Conseil : prends le plan **Builder**, avec plus de crédits pour construire ton app. En annuel, ton nom de domaine est offert la 1re année.",
            action: { kind: "open", label: "Voir les plans Base44", url: BASE44_PRICING_URL },
          },
          { text: "Garde l'onglet ouvert : tu y construis ton app juste après." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:landing",
        title: "Crée ton app et sa page d'accueil",
        why: "Ton nom, ton logo et ta promesse : ta page d'accueil dit tout de suite ce que fait ton app, et pour qui.",
        minutes: 15,
        steps: [
          { text: "Copie le message pour Base44.", action: { kind: "copy", prompt: "landing" } },
          { text: "Sur l'accueil de Base44, colle-le dans la case **Describe the app you want to build** et envoie : il crée ton app." },
          { text: "S'il te pose des questions, réponds-y ou clique sur **Skip question** : tout est déjà dans le message." },
          { text: "Regarde ta page d'accueil dans l'aperçu. Un texte à changer ? Demande-le à Base44 avec tes mots." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:accounts",
        title: "Ajoute les comptes",
        why: "Tes clients se créent un compte : leurs résultats sont gardés, et ils pourront s'abonner.",
        minutes: 15,
        steps: [
          { text: "Copie le message pour Base44.", action: { kind: "copy", prompt: "accounts" } },
          { text: "Colle-le dans le chat de ton app, dans Base44, et envoie : il ajoute la connexion, les paramètres et ton administration." },
          { text: "Dans Base44, ouvre **Dashboard**, puis **Overview**, et règle **App Visibility** sur **Public** : tout le monde doit voir ta page d'accueil." },
          { text: "Crée-toi un compte dans l'aperçu : comme c'est ton app, tu en es l'administrateur." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:onboarding",
        title: "Construis ton parcours d'accueil",
        why: "Quelques questions, un aperçu de son résultat, puis ton offre au bon moment : c'est ce qui transforme un curieux en client.",
        minutes: 20,
        steps: [
          { text: "Copie le message pour Base44.", action: { kind: "copy", prompt: "onboarding" } },
          { text: "Colle-le dans le chat de ton app et envoie : il ajoute les questions, puis l'écran d'abonnement." },
          { text: "Fais le parcours dans l'aperçu jusqu'à l'écran d'abonnement, puis clique sur **Débloquer mon résultat** et crée un compte." },
          { text: "Un souci ? Décris-le à Base44 avec tes mots : il corrige." },
        ],
        check: { kind: "manual" },
      },
      {
        // The key comes from when the whole app was built with a single prompt: kept, done missions are saved by key.
        key: "build:first_version",
        title: "Construis le cœur de ton app",
        why: "C'est ce que tes clients paient : le résultat complet que ton app leur donne.",
        minutes: 30,
        steps: [
          { text: "Copie le message pour Base44.", action: { kind: "copy", prompt: "app" } },
          { text: "Colle-le dans le chat de ton app et envoie : il construit l'écran principal de ton app." },
          {
            text: "Base44 te demande une clé OneShotAPI ? Crée-la ici, puis colle-la dans l'encadré **Set secrets** de Base44.",
            action: { kind: "open", label: "Créer ma clé OneShotAPI", url: ONESHOT_KEYS_URL },
          },
          { text: "Teste ton app dans l'aperçu jusqu'au résultat complet. Un souci ? Décris-le à Base44 avec tes mots : il corrige." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:customize",
        title: "Modifie ton app comme tu veux",
        why: "C'est ton app : Base44 change ce que tu veux dès que tu lui demandes, sans une ligne de code.",
        minutes: 20,
        steps: [
          { text: "Parcours ton app dans l'aperçu de Base44 et note ce que tu veux changer : un texte, une couleur, un écran." },
          { text: "Demande chaque changement à Base44 avec tes mots, un à la fois : il modifie ton app tout seul." },
          { text: "Vérifie le résultat dans l'aperçu. Pas ce que tu voulais ? Dis-lui ce qui ne va pas : il corrige." },
          {
            text: "En panne d'idées ? Demande à Gus ce qui rendrait ton app plus convaincante.",
            action: {
              kind: "gus",
              label: "Demander à Gus",
              message: "Qu'est-ce que je pourrais changer dans mon app pour qu'elle donne plus envie de payer, avant de la mettre en ligne ?",
            },
          },
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:review",
        title: "Valide ton app",
        why: "Base44 relit toute ton app et corrige ce qui cloche : tu publies une app propre, sans bouton mort ni promesse en l'air.",
        minutes: 15,
        steps: [
          { text: "Copie le message pour Base44.", action: { kind: "copy", prompt: "review" } },
          { text: "Colle-le dans le chat de ton app et envoie : il passe toute ton app en revue et corrige ce qui cloche." },
          { text: "Il te demande tes informations pour les pages légales ? Donne-les-lui : elles doivent être complètes avant de publier." },
          { text: "Lis son récap, puis refais tout le parcours dans l'aperçu. Encore un souci ? Décris-le à Base44 avec tes mots : il corrige." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:online",
        title: "Publie ton app",
        why: "Tant qu'elle n'est pas publiée, personne ne peut l'essayer ni la payer.",
        minutes: 2,
        // Its address is given in the next task, once on its own domain.
        steps: [{ text: "Dans Base44, clique sur **Publish** en haut à droite, puis sur **Publish** dans la fenêtre qui s'ouvre : ton app est en ligne." }],
        check: { kind: "manual" },
      },
      {
        key: "build:domain",
        title: "Achète ton nom de domaine dans Base44",
        why: "Une adresse à ton nom fait pro et rassure ceux qui vont payer.",
        minutes: 10,
        steps: [
          { text: "Dans Base44, ouvre **Dashboard**, **Domains**, **Buy new domain**, et cherche un nom court au nom de ton app, en **.com** si possible." },
          { text: "Clique sur **Get it**, choisis **1 year** et **Public Registration** (ce que couvre le domaine offert), puis **Submit Purchase**." },
          { text: "Confirme ton domaine avec le lien de l'e-mail que Wix t'envoie (regarde aussi dans tes spams)." },
          { text: "Quand ton domaine est en ligne (en général moins de 30 minutes), colle l'adresse de ton app ici.", action: { kind: "app_url" } },
        ],
        check: { kind: "custom_domain" },
      },
    ],
  },
  {
    key: "payment",
    title: "Encaisse ton premier paiement",
    label: "Paiement test",
    detail: "Ton app sait encaisser : un paiement passe de bout en bout.",
    missions: [
      {
        key: "payment:whop",
        title: "Crée ta boutique Whop",
        why: "Whop encaisse les paiements de ton app pour toi.",
        minutes: 15,
        steps: [
          {
            text: "Crée ton compte Whop et choisis **Use Whop for payment processing only** : ton app reste chez Base44.",
            action: { kind: "open", label: "Ouvrir Whop", url: WHOP_SELL_URL },
          },
          { text: "Nomme ta boutique comme ton app, puis ajoute un produit : un abonnement mensuel, au prix de ton offre." },
          {
            text: "Dans **Checkout links**, copie le lien de paiement de ce produit et colle-le ici : il ira dans le message pour Base44.",
            action: { kind: "payment_link" },
          },
        ],
        check: { kind: "payment_link" },
      },
      {
        key: "payment:in_app",
        title: "Ajoute le paiement à ton app",
        why: "Ton client paie depuis ton app, et son compte passe Pro tout seul.",
        minutes: 20,
        steps: [
          { text: "Copie le message pour Base44.", action: { kind: "copy", prompt: "payment" } },
          { text: "Colle-le dans le chat de ton app et envoie : ton lien de paiement Whop est déjà dedans." },
          {
            text: "Base44 te demande ta clé Whop ? Crée-la dans **Account API Keys**, puis colle-la dans l'encadré **Set secrets**.",
            action: { kind: "open", label: "Ouvrir mes clés Whop", url: WHOP_DEVELOPER_URL },
          },
          { text: "Garde l'adresse du webhook que Base44 te donne à la fin : tu la colles dans Whop juste après." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "payment:webhook",
        title: "Relie Whop à ton app",
        why: "Dès qu'un client paie ou annule, Whop prévient ton app, qui ouvre ou ferme son accès toute seule.",
        minutes: 10,
        steps: [
          { text: "Dans Base44, clique sur **Publish** : ton app en ligne doit pouvoir recevoir les messages de Whop." },
          {
            text: "Dans Whop, clique sur **Create webhook** : colle l'adresse de Base44, garde **v1** et coche **membership.updated**.",
            action: { kind: "open", label: "Ouvrir Whop", url: WHOP_DEVELOPER_URL },
          },
          { text: "Copie le secret du webhook (il commence par **ws_**, dans la colonne **Secret**)." },
          { text: "Dans Base44, ouvre **Dashboard**, **Secrets**, **Add Secret** : nomme-le **WHOP_WEBHOOK_SECRET** et colle le secret." },
        ],
        check: { kind: "manual" },
      },
      {
        // Before the payment test: MakeSaaS checks it on this account.
        key: "payment:connect",
        title: "Connecte tes paiements à MakeSaaS",
        why: "MakeSaaS voit ton paiement test, puis tes revenus, tout seul.",
        minutes: 5,
        steps: [
          {
            text: "Connecte ton compte Whop avec une clé en lecture seule : la fenêtre t'explique où la trouver.",
            action: { kind: "payment_account", provider: "whop" },
          },
          { text: "Ton tableau de bord suit tes revenus tout seul : ton MRR et tes abonnés s'y mettent à jour à chaque vente.", action: REVENUE },
          {
            text: "Une question sur tes chiffres ? Demande à Gus : il les voit déjà.",
            action: {
              kind: "gus",
              label: "Analyser avec Gus",
              message: "Analyse mes revenus avec moi : où j'en suis, et ce que je peux faire pour les faire grimper.",
            },
          },
        ],
        check: { kind: "payment_account" },
      },
      {
        key: "payment:test",
        title: "Fais un paiement test",
        why: "La preuve que tout marche, avant de montrer ton app au monde.",
        minutes: 15,
        steps: [
          { text: "Dans Whop, crée un code promo à 100 % pour toi." },
          { text: "Ouvre ton app en ligne, crée un compte avec une autre adresse e-mail, va jusqu'au paiement et utilise ton code." },
          { text: "De retour dans ton app, ce compte passe Pro tout seul en quelques secondes. Pas le cas ? Décris-le à Base44 : il corrige." },
          {
            text: "Annule cet abonnement test avec **Gérer mon abonnement**, puis vérifie que MakeSaaS le voit sur ton compte Whop.",
            action: { kind: "test_payment" },
          },
        ],
        check: { kind: "test_payment" },
      },
    ],
  },
  {
    key: "video",
    title: "Poste ta première vidéo",
    label: "1re vidéo",
    detail: "Les premières personnes découvrent ton app sur TikTok.",
    missions: [
      {
        key: "video:account",
        title: "Crée un premier compte TikTok",
        why: "Un compte qui a l'air d'un utilisateur normal : ses vidéos passent pour un vrai avis, pas pour de la pub.",
        minutes: 10,
        steps: [
          { text: "Crée un nouveau compte TikTok, avec une adresse e-mail rien que pour lui." },
          { text: "Donne-lui l'air d'un utilisateur normal : un pseudo et une photo comme n'importe qui, pas le nom ni le logo de ton app." },
          { text: "Écris une bio courte, comme une vraie personne, sans faire de pub pour ton app." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "video:track",
        title: "Suis ton compte sur MakeSaaS",
        why: "Tu vois tes vues, et tes vidéos font avancer ta roadmap toutes seules.",
        minutes: 2,
        steps: [{ text: "Ajoute ton compte TikTok avec son @.", action: { kind: "tiktok_account" } }],
        check: { kind: "tiktok_accounts", min: 1 },
      },
      {
        key: "video:prepare",
        title: "Prépare ta première vidéo",
        why: "Montre le problème que règle ton app, puis le résultat qu'elle donne.",
        minutes: 20,
        steps: [
          { text: "Génère un carrousel sur le problème que règle ton app.", action: CONTENT },
          { text: "Ou filme ton écran : les questions de ton app, puis son résultat." },
          { text: "Termine en disant où trouver ton app." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "video:posted",
        title: "Poste-la",
        why: "La première est la plus dure. Ensuite, ça devient une habitude.",
        minutes: 5,
        steps: [{ text: "Publie ta vidéo sur ton compte TikTok." }],
        check: { kind: "videos", min: 1 },
      },
    ],
  },
  {
    key: "customer",
    title: "Trouve ton premier client",
    label: "1er client",
    detail: "Un inconnu paie pour ton app : la preuve qu'elle vaut quelque chose.",
    missions: [
      {
        key: "customer:7_videos",
        title: "Poste 7 vidéos",
        why: "C'est la régularité qui fait décoller un compte.",
        span: "7 jours",
        steps: [
          { text: "Poste une vidéo par jour pendant une semaine.", action: CONTENT },
          { text: "Change l'accroche à chaque fois : les 2 premières secondes font tout." },
        ],
        check: { kind: "videos", min: 7 },
      },
      {
        key: "customer:comments",
        title: "Réponds à chaque commentaire",
        why: "Les premiers curieux deviennent souvent les premiers clients.",
        span: "Chaque jour",
        steps: [
          { text: "Réponds à chaque commentaire, même court." },
          { text: "Une question ? Réponds-y en vidéo : c'est une vidéo de plus, déjà demandée." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "customer:first_payment",
        title: "Ton premier client paie",
        why: "Un inconnu qui paie, c'est le vrai départ.",
        steps: [{ text: "Continue de poster : le premier paiement arrive souvent après quelques vidéos qui marchent.", action: REVENUE }],
        check: { kind: "first_payment" },
      },
    ],
  },
];

/** The missions of the MRR stage number `level` (0 for the first), ending on `amount`. */
function mrrMissions(key: string, level: number, amount: number): RoadmapMission[] {
  const reached: RoadmapMission = {
    key: `${key}:reached`,
    title: `Atteins ${euros.format(amount)} par mois`,
    why: "Des abonnés qui paient chaque mois : ton revenu se construit.",
    steps: [{ text: "Suis ton revenu mensuel sur ton tableau de bord.", action: REVENUE }],
    check: { kind: "mrr", amount },
  };

  if (level === 0) {
    return [
      {
        key: `${key}:format`,
        title: "Trouve le format qui marche",
        why: "Une vidéo qui marche, c'est un modèle à refaire, pas un coup de chance.",
        minutes: 30,
        steps: [
          { text: "Repère tes 3 vidéos les plus vues.", action: STATS },
          { text: "Refais-en 5 sur le même modèle, avec une autre accroche." },
        ],
        check: { kind: "manual" },
      },
      {
        key: `${key}:30_videos`,
        title: "Poste 30 vidéos",
        why: "Plus tu postes, plus TikTok apprend à qui montrer ton app.",
        span: "30 jours",
        steps: [
          { text: "Garde le rythme : au moins une vidéo par jour.", action: CONTENT },
          { text: "Refais ce qui marche, change ce qui ne marche pas." },
        ],
        check: { kind: "videos", min: 30 },
      },
      {
        key: `${key}:paywall`,
        title: "Améliore ton écran de paiement",
        why: "Avec les mêmes vidéos, une meilleure offre rapporte plus.",
        minutes: 30,
        steps: [
          {
            text: "Montre ton écran de paiement à Gus : il te dit quoi changer.",
            action: {
              kind: "gus",
              label: "Demander à Gus",
              message: "Aide-moi à améliorer l'écran de paiement de mon app pour que plus de gens s'abonnent. Pose-moi les questions dont tu as besoin.",
            },
          },
          { text: "Demande à Base44 d'appliquer ses conseils, puis clique sur **Publish**." },
        ],
        check: { kind: "manual" },
      },
      reached,
    ];
  }

  if (level === 1) {
    return [
      {
        key: `${key}:2_accounts`,
        title: "Ouvre un 2e compte TikTok",
        why: "Deux comptes, deux fois plus de chances que TikTok pousse tes vidéos.",
        minutes: 15,
        steps: [
          { text: "Crée un second compte d'utilisateur normal, sur un autre angle." },
          { text: "Ajoute-le sur MakeSaaS avec son @.", action: { kind: "tiktok_account" } },
        ],
        check: { kind: "tiktok_accounts", min: 2 },
      },
      {
        key: `${key}:100_videos`,
        title: "Poste 100 vidéos",
        why: "À ce stade, c'est le volume qui fait la différence.",
        span: "2 mois",
        steps: [
          { text: "Poste chaque jour sur tes deux comptes.", action: CONTENT },
          { text: "Recycle tes meilleures vidéos avec une nouvelle accroche." },
        ],
        check: { kind: "videos", min: 100 },
      },
      {
        key: `${key}:retention`,
        title: "Garde tes abonnés",
        why: "Un abonné qui reste vaut plus qu'un nouveau qui part.",
        minutes: 30,
        steps: [
          { text: "Regarde combien d'abonnés partent chaque mois.", action: REVENUE },
          {
            text: "Demande à Gus comment leur donner une raison de rester.",
            action: {
              kind: "gus",
              label: "Demander à Gus",
              message: "Des abonnés quittent mon app chaque mois. Aide-moi à leur donner une raison de rester : un suivi, un rappel, une nouveauté.",
            },
          },
          { text: "Demande à Base44 d'ajouter son idée à ton app, puis clique sur **Publish**." },
        ],
        check: { kind: "manual" },
      },
      reached,
    ];
  }

  const accounts = level + 1;
  return [
    {
      key: `${key}:${accounts}_accounts`,
      title: `Passe à ${accounts} comptes TikTok`,
      why: "Chaque compte de plus, ce sont plus de chances qu'une vidéo décolle.",
      minutes: 15,
      steps: [
        { text: "Ouvre un nouveau compte sur un angle que tu n'as pas encore testé." },
        { text: "Ajoute-le sur MakeSaaS avec son @.", action: { kind: "tiktok_account" } },
      ],
      check: { kind: "tiktok_accounts", min: accounts },
    },
    ...(level === 2
      ? [
          {
            key: `${key}:annual`,
            title: "Propose une offre annuelle",
            why: "Un abonnement à l'année encaisse plus tôt, et tes abonnés restent plus longtemps.",
            minutes: 30,
            steps: [
              { text: "Dans Whop, ajoute un abonnement annuel, moins cher que 12 mois." },
              { text: "Demande à Base44 de l'afficher sur ton écran de paiement, puis clique sur **Publish**." },
            ],
            check: { kind: "manual" as const },
          },
        ]
      : []),
    {
      key: `${key}:creators`,
      title: "Fais poster d'autres créateurs",
      why: "Pour aller plus loin, d'autres créateurs postent pour ton app.",
      span: "Quelques semaines",
      steps: [
        { text: "Propose à des créateurs de ta niche de poster sur ton app, payés à la vidéo ou aux vues." },
        { text: "Donne-leur tes formats qui marchent.", action: STATS },
      ],
      check: { kind: "manual" },
    },
    reached,
  ];
}

/**
 * The stages of a member's roadmap, in order: the base ones, then one per MRR tier under their goal,
 * then the goal itself.
 */
export function roadmapStagesFor(goal: number): RoadmapStage[] {
  const target = monthlyGoalOf(goal);
  const amounts = [...MRR_TIERS.filter((tier) => tier < target), target];
  return [
    ...BASE_STAGES,
    ...amounts.map((amount, level): RoadmapStage => {
      const isGoal = level === amounts.length - 1;
      const key = `mrr_${amount}`;
      return {
        key,
        title: isGoal ? `Ton objectif : ${euros.format(amount)} par mois` : `${euros.format(amount)} par mois`,
        label: `${euros.format(amount)}/mois`,
        detail: isGoal
          ? "Le sommet que tu t'es fixé : ton app te rapporte ce que tu voulais, chaque mois."
          : `Ton app te rapporte ${euros.format(amount)} chaque mois, en abonnements.`,
        missions: mrrMissions(key, level, amount),
        mrr: amount,
        ...(isGoal ? { isGoal } : {}),
      };
    }),
  ];
}

/**
 * The milestones the Roadmap page shows, in order: each one checked from the SaaS's data by one of the
 * missions above (its key), never ticked by hand. The launch ones first, then the growth ones up to
 * the member's goal.
 */
export function milestonesFor(goal: number): Milestone[] {
  const stages = roadmapStagesFor(goal);
  const checkOf = (key: string) => {
    const mission = stages.flatMap((stage) => stage.missions).find((item) => item.key === key);
    if (!mission) throw new Error(`No mission ${key} for a milestone`);
    return mission.check;
  };
  const milestone = (key: string, title: string, detail: string, phase: Milestone["phase"], link?: Milestone["link"]): Milestone => ({
    key,
    title,
    detail,
    check: checkOf(key),
    phase,
    ...(link ? { link } : {}),
  });
  const linkOf = (action: StepAction) => (action.kind === "page" ? { label: action.label, href: action.href } : undefined);

  return [
    milestone("idea:chosen", "Ton idée", "Tu sais ce que tu construis, et pour qui.", "launch"),
    milestone("brand:logo", "Ton logo", "Ton SaaS a son logo et ses couleurs.", "launch"),
    milestone("build:domain", "Ton app en ligne", "Tout le monde peut l'ouvrir, à son adresse.", "launch"),
    milestone("payment:connect", "Tes paiements connectés", "MakeSaaS suit tes revenus tout seul.", "launch", linkOf(REVENUE)),
    milestone("video:track", "Ton compte TikTok", "Tes vidéos sont suivies sur MakeSaaS.", "launch", linkOf(STATS)),
    milestone("video:posted", "Ta 1re vidéo", "Les premières personnes découvrent ton app.", "launch", linkOf(STATS)),
    milestone("customer:7_videos", "7 vidéos", "La régularité, c'est ce qui fait décoller un compte.", "growth", linkOf(STATS)),
    milestone("customer:first_payment", "Ton 1er client", "Un inconnu paie pour ton app.", "growth", linkOf(REVENUE)),
    ...stages
      .filter((stage) => stage.mrr)
      .map((stage) => ({
        ...milestone(`${stage.key}:reached`, `${euros.format(stage.mrr!)} par mois`, stage.detail, "growth", linkOf(REVENUE)),
        mrr: stage.mrr,
        ...(stage.isGoal ? { isGoal: true } : {}),
      })),
  ];
}

/**
 * The tasks of every day once the SaaS is launched (shared/today.ts), until Gus writes them: keyed by
 * their day, so each day has its own, ticked by the member.
 */
export function dailyTasks(day: string): RoadmapMission[] {
  return [
    {
      key: `daily:video:${day}`,
      title: "Poste une vidéo",
      why: "Plus tu postes, plus TikTok apprend à qui montrer ton app.",
      minutes: 20,
      steps: [
        { text: "Prépare-la : un carrousel sur le problème que règle ton app, ou ton écran qui montre son résultat.", action: CONTENT },
        { text: "Publie-la sur ton compte TikTok, avec une accroche différente d'hier." },
      ],
      check: { kind: "manual" },
    },
    {
      key: `daily:comments:${day}`,
      title: "Réponds aux commentaires",
      why: "Les premiers curieux deviennent souvent les premiers clients.",
      minutes: 10,
      steps: [
        { text: "Réponds à chaque commentaire de tes vidéos, même court." },
        { text: "Une question qui revient ? Note-la : c'est ta prochaine vidéo." },
      ],
      check: { kind: "manual" },
    },
  ];
}

/** "5 min", "1 h", "1 h 30". */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

/** How long a mission takes, shown by its title; null for what happens on its own. */
export function missionTime(mission: RoadmapMission): string | null {
  if (mission.span) return mission.span;
  return mission.minutes ? formatMinutes(mission.minutes) : null;
}

/** About how long the stage's missions still to do take ("≈ 40 min"); null when one takes days, or none is left. */
export function stageTimeLeft(stage: RoadmapStage, done: Record<string, MissionDone>): string | null {
  const left = stage.missions.filter((mission) => !done[mission.key]);
  if (!left.length || left.some((mission) => mission.span)) return null;
  const minutes = left.reduce((total, mission) => total + (mission.minutes ?? 0), 0);
  return minutes ? `≈ ${formatMinutes(minutes)}` : null;
}

/** What a mission checked from the data waits for, shown while it is not done (and given to Gus). */
export function missionCheckText(check: RoadmapMission["check"]): string {
  switch (check.kind) {
    case "manual":
      return "Coche-la quand c'est fait.";
    case "saas":
      return "Se coche dès que ton projet est créé.";
    case "custom_domain":
      return "Se coche dès que tu colles l'adresse de ton app sur ton nom de domaine et qu'elle répond.";
    case "logo":
      return "Se coche dès que ton projet a son logo.";
    case "payment_link":
      return "Se coche dès que tu colles le lien de paiement Whop de ton app.";
    case "payment_account":
      return "Se coche dès que ton compte de paiement est connecté.";
    case "test_payment":
      return "Se coche dès que MakeSaaS voit ton paiement test sur ton compte Whop connecté.";
    case "tiktok_accounts":
      return check.min > 1
        ? `Se coche dès que ${check.min} comptes TikTok sont suivis sur MakeSaaS.`
        : "Se coche dès que ton compte TikTok est suivi sur MakeSaaS.";
    case "videos":
      return check.min > 1
        ? `Se coche dès que tes comptes TikTok ont ${check.min} vidéos.`
        : "Se coche dès que ta vidéo apparaît dans tes statistiques.";
    case "first_payment":
      return "Se coche au premier paiement sur ton compte connecté (hors compte de test).";
    case "mrr":
      return `Se coche dès que ton revenu mensuel atteint ${euros.format(check.amount)}.`;
  }
}
