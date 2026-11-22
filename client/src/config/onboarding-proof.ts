// Proof shown at the end of the onboarding (screens "résultats" and "preuves").
//
// ⚠️ PLACEHOLDER: LAUNCH_RESULTS must be replaced by the real figures of an app you launched
// yourself before going live (same rule as the placeholder testimonials and member count:
// advertising invented results is a misleading commercial practice).
// ⚠️ SUCCESS_STORIES and MARKET_STORY repeat public figures quoted by FirstMRR: check each one
// at its source before going live.

/** Your own app, the day it launched and a few days later: revenue per day, real numbers. */
export const LAUNCH_RESULTS = {
  appName: "Ton app",
  /** Badge next to the chart: only say "Chiffres réels" once the figures are real. */
  badge: "Exemple",
  /** Gross revenue per day, from launch day to the best day. */
  daily: [4, 23, 108, 12, 102, 69, 118, 169, 159, 339],
  launch: { day: "7 août", payments: 2, signups: 81 },
  best: { day: "16 août", payments: 15, signups: 525 },
  review: {
    quote: "9 jours après le lancement de mon app, j'ai fait 340 € en un jour.",
    author: "Fondateur de l'app",
    note: "Résultat personnel, non garanti.",
  },
};

export type SuccessStory = {
  name: string;
  who: string;
  label: string;
  amount: string;
  unit?: string;
  text: string;
  source: string;
};

export const SUCCESS_STORIES: SuccessStory[] = [
  {
    name: "Cal AI",
    who: "Zach, fondateur",
    label: "Revenus",
    amount: "30 M$",
    unit: "par an",
    text: "Lancée par Zach à 17 ans, avec un ami du lycée. Rachetée ensuite par MyFitnessPal.",
    source: "TechCrunch",
  },
  {
    name: "Base44",
    who: "Maor, fondateur",
    label: "Rachat",
    amount: "80 M$",
    text: "Lancé par une seule personne en mars 2025, sans levée de fonds. Racheté par Wix en juin.",
    source: "Globes",
  },
  {
    name: "Photo AI",
    who: "Pieter, seul, sans employé",
    label: "Revenus",
    amount: "105 000 $",
    unit: "par mois",
    text: "Après des dizaines de projets ratés.",
    source: "chiffre publié par lui-même",
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
