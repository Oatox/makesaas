import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { detailKey, optionLabel } from "./steps";

// What the screens without a question say about the visitor, deduced from the answers (same rules
// as the FirstMRR funnel). Pure functions: nothing here is stored or sent anywhere.

/** What a strength is about: picks its icon on the profile screen. */
export type StrengthKind = "drive" | "passion" | "speed" | "solid" | "started" | "dared" | "customers" | "early" | "income" | "seller" | "first-step";
export type Strength = { kind: StrengthKind; title: string; text: string };
export type Weakness = { title: string; fix: string };
export type PotentialRow = { label: string; value: string; /** 1 to 5, or null when not a level. */ level: number | null };

const DEFAULT_GOAL = 10_000;

export const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const text = (answers: OnboardingAnswers, key: string) => {
  const value = answers[key];
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
};
const list = (answers: OnboardingAnswers, key: string) => {
  const value = answers[key];
  return Array.isArray(value) ? value : [];
};
const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

/** First name with a capital, "toi" when missing. */
export function firstName(answers: OnboardingAnswers) {
  const name = text(answers, "prenom");
  return name ? name.charAt(0).toLocaleUpperCase("fr-FR") + name.slice(1) : "toi";
}

/** Monthly goal picked on the "revenu" slider, in euros. */
export function goalOf(answers: OnboardingAnswers) {
  const goal = Number(text(answers, "revenu"));
  return Number.isFinite(goal) && goal > 0 ? goal : DEFAULT_GOAL;
}

/** Replaces `{prenom}`, `{objectif}` and `{reveFin}` in a text of the steps. */
export function fillTemplate(template: string, answers: OnboardingAnswers) {
  return template
    .replaceAll("{prenom}", firstName(answers))
    .replaceAll("{objectif}", euros.format(goalOf(answers)))
    .replaceAll("{reveFin}", template.includes("{reveFin}") ? dreamEnding(answers) : "");
}

export type SituationTag = { kind: "age" | "profil"; label: string };

/** Age ("20 ans") and situation ("Salarié"): who the visitor is, next to the first name. */
export function situationTags(answers: OnboardingAnswers): SituationTag[] {
  const age = text(answers, "age");
  const profile = optionLabel("profil", answers.profil);
  return [
    ...(age ? [{ kind: "age" as const, label: `${age} ans` }] : []),
    ...(profile ? [{ kind: "profil" as const, label: profile }] : []),
  ];
}

const PASSIONS = ["sport", "jeux-video", "vetements", "business-tech", "autre"];

/** What the visitor is passionate about: the detail written, or the option picked ("Le sport"). */
export function passionText(answers: OnboardingAnswers) {
  const passion = text(answers, "passion");
  if (!PASSIONS.includes(passion)) return null;
  const detail = text(answers, detailKey("passion"));
  if (detail) return detail;
  return passion === "autre" ? null : (optionLabel("passion", passion) ?? null);
}

/** How badly the visitor wants it, 1 to 5: what was said on the slider, otherwise the quick answers. */
export function desire(answers: OnboardingAnswers) {
  const said = Number(text(answers, "perseverance"));
  if (said >= 1) return Math.min(5, Math.round(said));
  return Math.min(5, 2 + drive(answers));
}

/** Points earned on the quick questions of the analysis: unhappy with the situation, underpaid. */
function drive(answers: OnboardingAnswers) {
  const satisfaction = { oui: 0, "pas-vraiment": 1, non: 2 }[text(answers, "satisfaction")] ?? 0;
  const merite = { oui: 0, "pas-encore": 1, non: 1 }[text(answers, "merite")] ?? 0;
  return satisfaction + merite;
}

const DESIRE_WORDS = ["", "Présente", "Présente", "Réelle", "Forte", "Très forte"];
const DEADLINE_LEVEL: Record<string, number> = { aujourdhui: 5, "1sem": 4, "2sem": 3, "1mois": 2 };
const DEADLINE_WEIGHT: Record<string, number> = { aujourdhui: 0.95, "1sem": 0.9, "2sem": 0.82, "1mois": 0.7 };

/** Potential score, 48 to 96: desire, passion, how clear the goal is, and how soon it must work. */
export function potential(answers: OnboardingAnswers) {
  const passion = PASSIONS.includes(text(answers, "passion")) ? (text(answers, detailKey("passion")) ? 0.85 : 0.75) : 0.6;
  const want = desire(answers) / 5;
  const clarity = (list(answers, "vie").length > 0 ? 0.5 : 0.25) + (text(answers, "phrase") ? 0.3 : 0.15) + 0.15;
  const deadline = DEADLINE_WEIGHT[text(answers, "echeance")] ?? 0.7;
  return Math.round(Math.min(96, 48 + 48 * (0.32 * want + 0.26 * passion + 0.22 * Math.min(1, clarity) + 0.2 * deadline)));
}

export function potentialRows(answers: OnboardingAnswers): PotentialRow[] {
  const level = desire(answers);
  const deadline = text(answers, "echeance");
  return [
    { label: "Ton envie", value: DESIRE_WORDS[level], level },
    { label: "Ta passion", value: passionText(answers) ?? "À définir", level: null },
    { label: "Ton échéance", value: optionLabel("echeance", deadline) ?? "À définir", level: DEADLINE_LEVEL[deadline] ?? 2 },
  ];
}

const PASSION_STRENGTH: Record<string, string> = {
  sport: "Tu sais ce qui manque aux sportifs. Ce sont tes premiers clients.",
  "jeux-video": "Tu sais ce qui manque aux joueurs. Ce sont tes premiers clients.",
  vetements: "Tu sais ce que cherchent ceux qui aiment s'habiller. Ce sont tes premiers clients.",
  "business-tech": "Tu parles déjà le langage des outils et du business. Tu iras plus vite.",
};

/** Up to three strengths, from the answers. */
export function strengths(answers: OnboardingAnswers): Strength[] {
  const found: Strength[] = [];

  if (drive(answers) > 0) found.push({ kind: "drive", title: "Tu refuses de rester où tu es", text: "Et c'est souvent le vrai déclic." });

  const passion = passionText(answers);
  if (passion) {
    const label = optionLabel("passion", answers.passion);
    found.push({
      kind: "passion",
      title: `Tu connais ${passion === label ? lowerFirst(passion) : passion} de l'intérieur`,
      text: PASSION_STRENGTH[text(answers, "passion")] ?? "Tu sais ce qui manque aux passionnés comme toi. Ce sont tes premiers clients.",
    });
  }

  const deadline = text(answers, "echeance");
  if (deadline === "aujourdhui") found.push({ kind: "speed", title: "Tu veux que ça bouge", text: "Tu veux commencer dès aujourd'hui." });
  if (deadline === "1sem" || deadline === "2sem") {
    found.push({ kind: "speed", title: "Tu veux que ça bouge", text: `Un premier résultat d'ici ${optionLabel("echeance", deadline)?.toLowerCase()}.` });
  }
  if (deadline === "1mois") found.push({ kind: "solid", title: "Tu vises du solide", text: "Un mois pour construire quelque chose de propre." });

  const experience = text(answers, "experience");
  if (experience === "en-cours") found.push({ kind: "started", title: "Tu as déjà commencé", text: "Ton projet est en route, la plupart ne s'y mettent jamais." });
  if (experience === "abandon") found.push({ kind: "dared", title: "Tu as déjà osé", text: "Tu t'es déjà lancé une fois, la plupart ne l'ont jamais fait." });
  if (experience === "vendu" || experience === "tourne") found.push({ kind: "customers", title: "Tu as déjà eu des clients", text: "Le plus dur est derrière toi." });

  const profile = text(answers, "profil");
  if (profile === "etudiant") found.push({ kind: "early", title: "Tu commences tôt", text: "Du temps devant toi, et presque rien à perdre." });
  if (profile === "salarie") found.push({ kind: "income", title: "Tu as un revenu stable", text: "Tu peux lancer ton projet sans pression." });
  if (profile === "freelance") found.push({ kind: "seller", title: "Tu sais déjà vendre ton travail", text: "Une app peut te rapporter sans vendre ton temps." });

  if (found.length === 0) found.push({ kind: "first-step", title: "Tu as fait le premier pas", text: "Tu es ici, la plupart ne s'y mettent jamais." });
  return found.slice(0, 3);
}

/** Up to three weaknesses, each with what the plan does about it. */
export function weaknesses(answers: OnboardingAnswers): Weakness[] {
  const found: Weakness[] = [];
  const add = (title: string, fix: string) => {
    if (!found.some((w) => w.title === title)) found.push({ title, fix });
  };
  const noTime = () => add("Tu manques de temps", "Ton plan rentre dans tes semaines, une tâche à la fois.");
  const noStart = () => add("Tu ne sais pas par où commencer", "Ton étape 1 est prête dès le premier jour.");

  // Only the follow-up of the current "experience": the answer to another branch may still be
  // saved when the visitor went back and changed it.
  const experience = text(answers, "experience");
  const branch = (step: string, value: string) => (experience === value ? text(answers, step) : "");

  const never = branch("pq-jamais", "jamais");
  if (never === "depart") noStart();
  if (never === "idee") add("Tu ne sais pas quoi lancer", "On te propose 3 idées prêtes, faites pour toi.");
  if (never === "peur") add("Tu as peur d'échouer", "Des petits pas, sans jamais risquer gros.");
  if (never === "temps") noTime();

  const building = branch("pq-en-cours", "en-cours");
  if (building === "finir") add("Ton projet n'est pas encore fini", "On découpe ce qui reste en petites étapes.");
  if (building === "clients") add("Tu ne sais pas encore qui va l'acheter", "On te montre où trouver tes premiers clients.");
  if (building === "temps") noTime();
  if (building === "peur") add("Tu as peur de le montrer", "On le teste d'abord avec quelques personnes, sans risque.");

  const gaveUp = branch("pq-abandon", "abandon");
  if (gaveUp === "clients") add("Tu n'as pas trouvé tes clients", "On te montre où les trouver.");
  if (gaveUp === "motivation") add("Tu as perdu la motivation", "Ton coach te relance chaque semaine.");
  if (gaveUp === "temps") add("Tu as manqué de temps", "Des tâches courtes, qui rentrent dans tes journées.");
  if (gaveUp === "complique") add("C'était trop compliqué", "Tout est découpé en petites étapes simples.");

  const sold = branch("pq-vendu", "vendu");
  if (sold === "reguliers") add("Tes ventes ne sont pas régulières", "On rend tes ventes régulières.");
  if (sold === "systeme") add("Tu n'as pas de système", "Chaque semaine, tu sais quoi faire et dans quel ordre.");
  if (sold === "offre") add("Ton offre n'est pas assez forte", "On la retravaille avec toi.");
  if (sold === "temps") add("Tu manques de temps", "On garde seulement les tâches qui rapportent.");

  const running = branch("pq-tourne", "tourne");
  if (running === "clients") add("Tu ne trouves pas assez de clients", "On te montre où les trouver, et quoi leur dire.");
  if (running === "ameliorer") add("Tu ne sais pas quoi améliorer", "Ton coach te dit quoi changer en premier.");
  if (running === "seul") add("Tu avances seul", "Ton coach connaît ton projet et répond dès que tu bloques.");
  if (running === "temps") add("Tu manques de temps", "On garde seulement ce qui fait grandir ton projet.");

  if (experience === "jamais") add("Tu n'as encore jamais vendu en ligne", "On te montre où trouver tes premiers clients.");
  if (experience === "en-cours") add("Ton projet n'est pas encore en ligne", "On t'aide à le mettre en ligne, étape par étape.");

  for (const frustration of list(answers, "frustrations")) {
    if (frustration.endsWith("_argent")) add("Tu n'as pas d'argent à investir", "Pas besoin de gros budget : on te montre comment lancer.");
    if (frustration.endsWith("_temps") && frustration !== "i_temps") noTime();
    if (frustration === "e_cours" || frustration === "a_stagne") add("Tu ne sais pas quoi faire", "Chaque jour, tu sais quoi faire.");
    if (frustration === "e_avance") noStart();
    if (frustration === "s_plafond") add("Ton salaire plafonne", "Un revenu à côté, sans plafond.");
    if (frustration === "s_repet") add("Ton travail ne te plaît pas", "Ton projet peut devenir ta porte de sortie.");
  }

  add("Tu ne sais pas encore créer un site", "L'IA construit ton site, tu cliques.");
  return found.slice(0, 3);
}

/** Line under "il te manque la méthode", depending on where the visitor stands. */
export function methodLine(answers: OnboardingAnswers) {
  const experience = text(answers, "experience");
  if (experience === "abandon") return "Et c'est pour ça que ton dernier projet s'est arrêté.";
  if (experience === "en-cours") return "Et c'est pour ça que ton projet n'est pas encore en ligne.";
  if (experience === "vendu" || experience === "tourne") return "Et c'est pour ça que tes revenus ne décollent pas encore.";
  return "Et c'est pour ça que tu n'as encore rien lancé.";
}

/** What the visitor earns online today: 0, or unknown once they have had customers. */
export const earnsToday = (answers: OnboardingAnswers) =>
  ["vendu", "tourne"].includes(text(answers, "experience")) ? null : 0;

/** Hours given each week, as said ("moins de 10 h"). */
export const timeLabel = (answers: OnboardingAnswers) => optionLabel("time", answers.time)?.toLowerCase() ?? "le temps que tu as";

/** The visitor's dream in their words: up to two picks (or what they wrote for "Autre"). */
export function dreamWords(answers: OnboardingAnswers) {
  const written = text(answers, detailKey("vie"));
  return list(answers, "vie")
    .map((value) => (value === "autre" ? written : optionLabel("vie", value) ?? ""))
    .filter(Boolean)
    .slice(0, 2);
}

const DREAM_ENDINGS: Array<[value: string, ending: string]> = [
  ["riche", "devenir **riche**"],
  ["parents", "rendre **tes parents fiers**"],
  ["acheter", "t'acheter **tout ce que tu veux**"],
  ["prouver", "prouver que **tu en es capable**"],
];

/** "Un revenu qui tombe chaque mois, c'est enfin pouvoir rendre **tes parents fiers**." */
export function dreamEnding(answers: OnboardingAnswers) {
  const picked = list(answers, "vie");
  const endings = DREAM_ENDINGS.filter(([value]) => picked.includes(value)).map(([, ending]) => ending).slice(0, 2);
  return `Un revenu qui tombe chaque mois, c'est enfin pouvoir ${endings.length ? endings.join(" et ") : "vivre **la vie dont tu rêves**"}.`;
}

const BRAKES: Record<string, string> = {
  methode: "il te manque la méthode",
  concentration: "tu as du mal à te concentrer",
  essaie: "tu essaies, mais tu n'y arrives pas",
  commence: "tu commences tout juste",
};

/** What holds the visitor back, in their words, for "tu nous l'as dit : …". */
export const brakeMirror = (answers: OnboardingAnswers) => BRAKES[text(answers, "frein")] ?? "quelque chose te bloque encore";

/** The four milestones of the plan, from the idea to the monthly goal. */
export const roadmapSteps = (answers: OnboardingAnswers) => [
  { title: "Ton idée", detail: "Trois pistes choisies pour ton profil" },
  { title: "Ton site", detail: "Les outils nécessaires, sans code" },
  { title: "Tes premiers revenus", detail: "Les canaux qui marchent pour ton projet" },
  { title: `${euros.format(goalOf(answers))} par mois`, detail: `${timeLabel(answers).replace(/^./, (c) => c.toUpperCase())} par semaine, étape par étape` },
];

/** Rounded to the hundred, 100 at least. */
const hundreds = (value: number) => Math.max(100, Math.round(value / 100) * 100);

/**
 * Monthly range the visitor could reach, from the goal and the potential score. An indicative
 * estimate, said as such on the screen.
 */
export function projection(answers: OnboardingAnswers) {
  const goal = goalOf(answers);
  const score = potential(answers) / 100;
  const low = hundreds(goal * (0.55 + 0.35 * score));
  const high = hundreds(goal * (1.05 + 0.45 * score));

  return {
    goal,
    low,
    high,
    resale: "Ton app se revend, souvent plusieurs années de revenus d'un coup.",
  };
}
