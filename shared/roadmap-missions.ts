import { MRR_TIERS, monthlyGoalOf, type RoadmapMission, type RoadmapStage } from "./roadmap";

/**
 * The content of the roadmap: its stages, their missions and each mission's tutorial (shared/roadmap.ts
 * says how they work). Edit the texts freely; keep the keys: done missions are saved by key.
 */

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const STATS = { label: "Mes statistiques TikTok", href: "/acquisition" };
const CONTENT = { label: "Créer un carrousel", href: "/acquisition/contenu" };
const GUS = { label: "Demander à Gus", href: "/discussions" };
const REVENUE = { label: "Mes revenus", href: "/app" };

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
        steps: ["Gus t'a proposé des idées faites pour ton profil, et tu en as gardé une : c'est ton projet."],
        check: { kind: "saas" },
      },
    ],
  },
  {
    key: "build",
    title: "Construis ton app",
    label: "App en ligne",
    detail: "Ton app marche et n'importe qui peut l'ouvrir, sans que tu aies écrit une ligne de code.",
    missions: [
      {
        key: "build:claude",
        title: "Installe Claude",
        why: "C'est lui qui écrit ton app pendant que tu la décris.",
        steps: [
          "Télécharge l'application **Claude** sur ton ordinateur : [claude.ai/download](https://claude.ai/download).",
          "Connecte-toi, puis prends l'abonnement **Pro** : c'est lui qui donne accès à Claude Code.",
          "Ouvre l'onglet **Code** de l'application.",
          "Crée un dossier vide pour ton app sur ton ordinateur, puis choisis-le dans Claude.",
        ],
        check: { kind: "manual" },
      },
      {
        key: "build:first_version",
        title: "Construis la première version",
        why: "Une version simple qui marche jusqu'au résultat vaut mieux qu'une app parfaite jamais finie.",
        steps: [
          "Copie le prompt ci-dessous, colle-le dans Claude et envoie-le.",
          "Réponds à ses questions, une par une : il écrit ensuite le plan de ton app dans **SPEC.md**.",
          "Laisse-le construire, puis teste dans son aperçu tout le parcours, jusqu'à l'écran de résultat.",
          "Quelque chose ne va pas ? Décris-le à Claude avec tes mots : il corrige.",
        ],
        check: { kind: "manual" },
        tool: "app_prompt",
      },
      {
        key: "build:online",
        title: "Mets ton app en ligne",
        why: "Tant qu'elle n'a pas d'adresse, personne ne peut l'essayer ni la payer.",
        steps: [
          "Demande à Claude : « Mets mon app en ligne gratuitement avec Netlify, guide-moi étape par étape et donne-moi son adresse. »",
          "Suis ses étapes : il te fait créer un compte Netlify gratuit, puis publie ton app.",
          "Ouvre l'adresse sur ton téléphone et vérifie que tout marche.",
          "Colle l'adresse ci-dessous : la mission se coche toute seule si ton app répond.",
        ],
        check: { kind: "app_url" },
        tool: "app_url",
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
        steps: [
          "Crée ton compte sur [whop.com](https://whop.com).",
          "Crée ta boutique au nom de ton app.",
          "Ajoute un produit avec un abonnement mensuel, au prix de ton offre.",
          "Copie le lien de paiement de ce produit : il sert à la mission suivante.",
        ],
        check: { kind: "manual" },
      },
      {
        key: "payment:in_app",
        title: "Ajoute le paiement à ton app",
        why: "L'écran d'abonnement de ton app doit ouvrir le vrai paiement.",
        steps: [
          "Copie le prompt ci-dessous, remplace le lien par celui de ta page de paiement Whop, et envoie-le à Claude.",
          "Vérifie dans l'aperçu que le bouton ouvre bien ta page de paiement.",
          "Assure-toi que Claude a republié ton app.",
        ],
        check: { kind: "manual" },
        tool: "payment_prompt",
      },
      {
        key: "payment:test",
        title: "Fais un paiement test",
        why: "C'est la preuve que tout marche, avant de montrer ton app au monde.",
        steps: [
          "Dans Whop, crée un code promo à 100 % pour toi.",
          "Ouvre ton app en ligne (pas l'aperçu), va jusqu'au paiement et utilise ton code.",
          "Vérifie que le paiement passe et que tu reviens bien dans ton app.",
        ],
        check: { kind: "manual" },
      },
      {
        key: "payment:connect",
        title: "Connecte tes paiements à MakeSaaS",
        why: "Tes revenus et ta roadmap se mettent à jour tout seuls.",
        steps: [
          "Ouvre les réglages de ton SaaS, onglet **Paiements**.",
          "Colle une clé API Whop en lecture seule : la fenêtre t'explique où la trouver.",
        ],
        check: { kind: "payment_account" },
        tool: "payment_account",
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
        why: "Un compte dédié à ton app, pas ton compte perso : TikTok le montre aux bonnes personnes.",
        steps: [
          "Crée un nouveau compte TikTok avec une adresse e-mail dédiée à ton app.",
          "Prends le nom de ton app comme pseudo, et son logo en photo.",
          "Écris une bio d'une phrase : ce que fait ton app, et pour qui.",
        ],
        check: { kind: "manual" },
      },
      {
        key: "video:track",
        title: "Ajoute ton compte sur MakeSaaS",
        why: "Tu suis tes vues, et tes vidéos cochent ta roadmap toutes seules.",
        steps: ["Ouvre **Acquisition → Statistiques**.", "Ajoute ton compte TikTok avec son @."],
        check: { kind: "tiktok_accounts", min: 1 },
        links: [STATS],
      },
      {
        key: "video:prepare",
        title: "Prépare ta première vidéo",
        why: "Montre le problème que règle ton app, puis le résultat qu'elle donne.",
        steps: [
          "Génère un carrousel sur le problème que règle ton app, dans **Création de contenu**.",
          "Ou filme ton écran : les questions de ton app, puis son résultat.",
          "Termine en disant où trouver ton app.",
        ],
        check: { kind: "manual" },
        links: [CONTENT],
      },
      {
        key: "video:posted",
        title: "Poste-la",
        why: "La première est la plus dure. Ensuite, ça devient une habitude.",
        steps: [
          "Publie ta vidéo sur le compte de ton app.",
          "La mission se coche toute seule dès que tes statistiques TikTok la voient.",
        ],
        check: { kind: "videos", min: 1 },
        links: [STATS],
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
        why: "Une vidéo ne suffit presque jamais : c'est la régularité qui fait décoller un compte.",
        steps: ["Poste une vidéo par jour pendant une semaine.", "Change l'accroche à chaque fois : les deux premières secondes font tout."],
        check: { kind: "videos", min: 7 },
        links: [CONTENT],
      },
      {
        key: "customer:comments",
        title: "Réponds à chaque commentaire",
        why: "Les premiers curieux deviennent souvent les premiers clients.",
        steps: [
          "Réponds à chaque commentaire, même court.",
          "Quand quelqu'un pose une question, réponds-lui en vidéo : c'est une vidéo de plus, déjà demandée.",
        ],
        check: { kind: "manual" },
      },
      {
        key: "customer:first_payment",
        title: "Ton premier client paie",
        why: "Un inconnu qui paie, c'est le vrai départ.",
        steps: ["Rien de plus à faire : la mission se coche toute seule au premier paiement sur ton compte connecté (hors compte de test)."],
        check: { kind: "first_payment" },
        links: [REVENUE],
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
    steps: [`La mission se coche toute seule quand le revenu mensuel récurrent (MRR) de ton compte connecté atteint ${euros.format(amount)}.`],
    check: { kind: "mrr", amount },
    links: [REVENUE],
  };

  if (level === 0) {
    return [
      {
        key: `${key}:format`,
        title: "Trouve ton format qui marche",
        why: "Une vidéo qui marche, c'est un format à refaire, pas un coup de chance.",
        steps: ["Repère tes 3 vidéos les plus vues dans tes statistiques.", "Refais-en 5 sur le même format, avec une accroche différente."],
        check: { kind: "manual" },
        links: [STATS],
      },
      {
        key: `${key}:30_videos`,
        title: "Poste 30 vidéos",
        why: "Plus tu postes, plus TikTok apprend à qui montrer ton app.",
        steps: ["Garde le rythme d'au moins une vidéo par jour.", "Refais tes formats qui marchent, change ce qui ne marche pas."],
        check: { kind: "videos", min: 30 },
        links: [CONTENT],
      },
      {
        key: `${key}:paywall`,
        title: "Améliore ton écran de paiement",
        why: "Avec les mêmes vidéos, une meilleure offre rapporte plus.",
        steps: [
          "Décris ton écran de paiement à Gus, ou colle son texte : il te dit quoi changer.",
          "Applique ses conseils avec Claude, puis republie ton app.",
        ],
        check: { kind: "manual" },
        links: [GUS],
      },
      reached,
    ];
  }

  if (level === 1) {
    return [
      {
        key: `${key}:2_accounts`,
        title: "Ouvre un 2e compte TikTok",
        why: "Deux comptes, deux chances que TikTok pousse tes vidéos.",
        steps: ["Crée un second compte dédié à ton app, sur un angle différent.", "Ajoute-le sur MakeSaaS : il compte dans tes statistiques."],
        check: { kind: "tiktok_accounts", min: 2 },
        links: [STATS],
      },
      {
        key: `${key}:100_videos`,
        title: "Poste 100 vidéos",
        why: "À ce stade, le volume fait la différence.",
        steps: ["Poste chaque jour sur tes deux comptes.", "Recycle tes meilleures vidéos avec une nouvelle accroche."],
        check: { kind: "videos", min: 100 },
        links: [CONTENT],
      },
      {
        key: `${key}:retention`,
        title: "Garde tes abonnés",
        why: "Un abonné qui reste vaut plus qu'un nouveau qui part.",
        steps: [
          "Regarde ton churn sur l'Accueil : combien d'abonnés partent chaque mois.",
          "Demande à Gus comment leur donner une raison de rester : un suivi, un rappel, une nouveauté.",
        ],
        check: { kind: "manual" },
        links: [REVENUE, GUS],
      },
      reached,
    ];
  }

  const accounts = level + 1;
  return [
    {
      key: `${key}:${accounts}_accounts`,
      title: `Passe à ${accounts} comptes TikTok`,
      why: "Chaque compte de plus multiplie tes chances de vidéos qui décollent.",
      steps: ["Ouvre un nouveau compte sur un angle que tu n'as pas encore testé.", "Ajoute-le sur MakeSaaS."],
      check: { kind: "tiktok_accounts", min: accounts },
      links: [STATS],
    },
    ...(level === 2
      ? [
          {
            key: `${key}:annual`,
            title: "Propose une offre annuelle",
            why: "Un abonnement annuel encaisse plus tôt, et les abonnés restent plus longtemps.",
            steps: [
              "Ajoute dans Whop un abonnement annuel, moins cher que 12 mois.",
              "Affiche-le sur ton écran de paiement avec Claude, puis republie ton app.",
            ],
            check: { kind: "manual" as const },
          },
        ]
      : []),
    {
      key: `${key}:creators`,
      title: "Fais poster d'autres créateurs",
      why: "Pour aller plus loin, d'autres créateurs postent pour ton app.",
      steps: [
        "Propose à des créateurs de ta niche de poster sur ton app, payés à la vidéo ou aux vues.",
        "Donne-leur tes formats qui marchent.",
      ],
      check: { kind: "manual" },
      links: [GUS],
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

/** How a mission gets done, said under its tutorial. */
export function missionCheckText(check: RoadmapMission["check"]): string {
  switch (check.kind) {
    case "manual":
      return "Coche-la quand c'est fait.";
    case "saas":
      return "Cochée à la création de ton projet.";
    case "app_url":
      return "Se coche toute seule quand tu colles l'adresse de ton app et qu'elle répond.";
    case "payment_account":
      return "Se coche toute seule quand ton compte de paiement est connecté.";
    case "tiktok_accounts":
      return check.min > 1
        ? `Se coche toute seule quand ${check.min} comptes TikTok sont suivis sur MakeSaaS.`
        : "Se coche toute seule quand ton compte TikTok est suivi sur MakeSaaS.";
    case "videos":
      return check.min > 1
        ? `Se coche toute seule quand tes comptes TikTok ont ${check.min} vidéos.`
        : "Se coche toute seule quand ta première vidéo apparaît dans tes statistiques.";
    case "first_payment":
      return "Se coche toute seule au premier paiement sur ton compte connecté (hors compte de test).";
    case "mrr":
      return `Se coche toute seule quand ton revenu mensuel récurrent atteint ${euros.format(check.amount)}.`;
  }
}
