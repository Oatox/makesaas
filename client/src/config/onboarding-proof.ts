// Proof shown at the end of the onboarding (screen "preuves").
//
// ⚠️ SUCCESS_STORIES and MARKET_STORY repeat public figures: check each one at its source before
// going live, and keep them up to date.
// The logos (client/public/stories) are each app's own icon, taken from its official site; they
// belong to their owners and only illustrate these public stories.

export type SuccessStory = {
  name: string;
  who: string;
  label: string;
  amount: string;
  unit?: string;
  text: string;
  source: string;
  /** App icon, from client/public (a square image). Without it, the name's first letter. */
  logo?: string;
};

export const SUCCESS_STORIES: SuccessStory[] = [
  {
    name: "Cal AI",
    logo: "/stories/cal-ai.webp",
    who: "Zach, fondateur",
    label: "Revenus",
    amount: "30 M$",
    unit: "par an",
    text: "Lancée par Zach à 17 ans, avec un ami du lycée. Rachetée ensuite par MyFitnessPal.",
    source: "TechCrunch",
  },
  {
    name: "Base44",
    logo: "/stories/base44.png",
    who: "Maor, fondateur",
    label: "Rachat",
    amount: "80 M$",
    text: "Lancé par une seule personne en mars 2025, sans levée de fonds. Racheté par Wix en juin.",
    source: "Globes",
  },
  {
    name: "Photo AI",
    logo: "/stories/photo-ai.png",
    who: "Pieter, seul, sans employé",
    label: "Revenus",
    amount: "105 000 $",
    unit: "par mois",
    text: "Après des dizaines de projets ratés.",
    source: "chiffre publié par lui-même",
  },
  {
    name: "Lovable",
    logo: "/stories/lovable.png",
    who: "Anton et Fabian, fondateurs",
    label: "Revenus",
    amount: "200 M$",
    unit: "par an",
    text: "Parti d'un petit projet open source d'Anton. Ce chiffre, moins d'un an après son ouverture au public.",
    source: "Bloomberg",
  },
  {
    name: "Calendly",
    logo: "/stories/calendly.png",
    who: "Tope, fondateur",
    label: "Valorisation",
    amount: "3 Md$",
    text: "Lancé avec ses économies et un petit prêt, parce qu'il perdait trop de temps à caler ses rendez-vous.",
    source: "Forbes",
  },
  {
    name: "Mailchimp",
    logo: "/stories/mailchimp.png",
    who: "Ben et Mark, fondateurs",
    label: "Rachat",
    amount: "12 Md$",
    text: "Lancé en 2001 sans aucun investisseur, et jamais aucun ensuite. Racheté par Intuit en 2021.",
    source: "Intuit",
  },
];

export const MARKET_STORY: SuccessStory = {
  name: "Le bon moment",
  who: "L'App Store en 2025",
  label: "Nouvelles apps",
  amount: "557 000",
  text: "La plus forte hausse depuis 2016, grâce à l'IA.",
  source: "Appfigures",
};
