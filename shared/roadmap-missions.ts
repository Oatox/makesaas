import { MRR_TIERS, monthlyGoalOf, type MissionDone, type RoadmapMission, type RoadmapStage, type StepAction } from "./roadmap";

/**
 * The content of the roadmap: its stages, their missions and each mission's steps (shared/roadmap.ts
 * says how they work). The member goes through a mission one step at a time, so keep every step to one
 * short sentence starting with a verb, in everyday words, with at most one button. Edit the texts
 * freely; keep the keys: done missions are saved by key.
 */

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const STATS: StepAction = { kind: "page", label: "Ouvrir mes statistiques", href: "/acquisition" };
const CONTENT: StepAction = { kind: "page", label: "Créer un carrousel", href: "/acquisition/contenu" };
const REVENUE: StepAction = { kind: "page", label: "Voir mes revenus", href: "/app" };

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
    title: "Construis ton app",
    label: "App en ligne",
    detail: "Ton app marche et tout le monde peut l'ouvrir, sans que tu aies écrit une ligne de code.",
    missions: [
      {
        key: "build:claude",
        title: "Installe Claude",
        why: "C'est lui qui écrit ton app pendant que tu la décris.",
        minutes: 10,
        steps: [
          { text: "Télécharge l'application Claude sur ton ordinateur.", action: { kind: "open", label: "Télécharger Claude", url: "https://claude.ai/download" } },
          { text: "Connecte-toi et prends l'abonnement **Pro** : il donne accès à Claude Code." },
          { text: "Crée un dossier pour ton app, et mets-y ton logo sous le nom **logo.png**." },
          { text: "Dans Claude, ouvre l'onglet **Code** et choisis ce dossier." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:first_version",
        title: "Construis la première version",
        why: "Une app simple qui marche vaut mieux qu'une app parfaite jamais finie.",
        minutes: 60,
        steps: [
          { text: "Copie le message pour Claude.", action: { kind: "copy", prompt: "app" } },
          { text: "Colle-le dans Claude et envoie." },
          { text: "Réponds à ses questions, puis laisse-le construire." },
          { text: "Teste ton app dans son aperçu jusqu'à l'écran de résultat. Un souci ? Décris-le à Claude avec tes mots." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:online",
        title: "Mets ton app en ligne",
        why: "Sans adresse, personne ne peut l'essayer ni la payer.",
        minutes: 15,
        steps: [
          { text: "Copie ce message et envoie-le à Claude.", action: { kind: "copy", prompt: "online" } },
          { text: "Suis ses étapes, puis ouvre l'adresse qu'il te donne sur ton téléphone." },
          { text: "Colle l'adresse de ton app ici.", action: { kind: "app_url" } },
        ],
        check: { kind: "app_url" },
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
          { text: "Crée ton compte Whop.", action: { kind: "open", label: "Ouvrir Whop", url: "https://whop.com" } },
          { text: "Crée ta boutique au nom de ton app." },
          { text: "Ajoute un produit : un abonnement mensuel, au prix de ton offre." },
          { text: "Copie le lien de paiement de ce produit : tu en as besoin juste après." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "payment:in_app",
        title: "Ajoute le paiement à ton app",
        why: "Le bouton d'abonnement de ton app doit ouvrir ta page de paiement.",
        minutes: 15,
        steps: [
          { text: "Copie le message pour Claude.", action: { kind: "copy", prompt: "payment" } },
          { text: "Colle-le dans Claude, remplace **[COLLE TON LIEN…]** par ton lien Whop, puis envoie." },
          { text: "Vérifie dans l'aperçu que le bouton ouvre bien ta page de paiement." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "payment:test",
        title: "Fais un paiement test",
        why: "La preuve que tout marche, avant de montrer ton app au monde.",
        minutes: 10,
        steps: [
          { text: "Dans Whop, crée un code promo à 100 % pour toi." },
          { text: "Ouvre ton app en ligne, va jusqu'au paiement et utilise ton code." },
          { text: "Vérifie que le paiement passe et que tu reviens bien dans ton app." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "payment:connect",
        title: "Connecte tes paiements à MakeSaaS",
        why: "Tes revenus et ta roadmap se mettent à jour tout seuls.",
        minutes: 5,
        steps: [
          {
            text: "Connecte ton compte Whop avec une clé en lecture seule : la fenêtre t'explique où la trouver.",
            action: { kind: "settings", tab: "payments", label: "Connecter mon compte" },
          },
        ],
        check: { kind: "payment_account" },
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
        title: "Crée le compte TikTok de ton app",
        why: "Un compte rien que pour ton app : TikTok le montre aux bonnes personnes.",
        minutes: 10,
        steps: [
          { text: "Crée un nouveau compte TikTok, avec une adresse e-mail rien que pour ton app." },
          { text: "Mets le nom de ton app en pseudo, et ton logo en photo." },
          { text: "Écris une bio d'une phrase : ce que fait ton app, et pour qui." },
        ],
        check: { kind: "manual" },
      },
      {
        key: "video:track",
        title: "Suis ton compte sur MakeSaaS",
        why: "Tu vois tes vues, et tes vidéos font avancer ta roadmap toutes seules.",
        minutes: 2,
        steps: [{ text: "Ajoute ton compte TikTok avec son @.", action: STATS }],
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
        steps: [{ text: "Publie ta vidéo sur le compte de ton app." }],
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
    steps: [{ text: "Suis ton revenu mensuel sur l'Accueil.", action: REVENUE }],
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
          { text: "Demande à Claude d'appliquer ses conseils, puis de republier ton app." },
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
          { text: "Crée un second compte pour ton app, sur un autre angle." },
          { text: "Ajoute-le sur MakeSaaS.", action: STATS },
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
          { text: "Demande à Claude d'ajouter son idée à ton app." },
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
        { text: "Ajoute-le sur MakeSaaS.", action: STATS },
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
              { text: "Demande à Claude de l'afficher sur ton écran de paiement, puis de republier ton app." },
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
    case "app_url":
      return "Se coche dès que tu colles l'adresse de ton app et qu'elle répond.";
    case "logo":
      return "Se coche dès que ton projet a son logo.";
    case "payment_account":
      return "Se coche dès que ton compte de paiement est connecté.";
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
