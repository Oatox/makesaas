import {
  BatteryLow,
  Bird,
  Brain,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  CircleHelp,
  Clock,
  Coins,
  Compass,
  Cpu,
  Dumbbell,
  EyeOff,
  Flame,
  Frown,
  Gamepad2,
  Gem,
  GraduationCap,
  Hammer,
  HandCoins,
  Handshake,
  Heart,
  Hourglass,
  Laptop,
  Lightbulb,
  PackageX,
  PenLine,
  Puzzle,
  Repeat,
  Rocket,
  Route,
  RotateCcw,
  ShieldAlert,
  Shirt,
  ShoppingBag,
  Ellipsis,
  Sprout,
  Tag,
  Timer,
  TrendingDown,
  Trophy,
  Undo2,
  UserRound,
  Users,
  Wallet,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { COACH_NAME } from "@/components/brand/Coach";
import { LEGAL } from "@/config/legal";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";

/** Free text field shown once an option is picked ("Autre" → the visitor writes the answer). */
export type AnswerInput = {
  /** Line above the field ("Tu peux nous en dire plus ? (optionnel)"). */
  label?: string;
  placeholder: string;
  maxLength: number;
  /** The answer can be confirmed with the field left empty. */
  optional?: boolean;
};

export type OnboardingOption = {
  value: string;
  label: string;
  /** Icon shown before the label. */
  icon?: LucideIcon;
  /** Reply shown under the answers once this one is picked. */
  note?: string;
  /** Field shown once this one is picked; its text is saved under `<step id>-detail`. */
  input?: AnswerInput;
  /** "Autre": the visitor writes the answer in the card itself, which then shows it (saved under `<step id>-detail`). */
  free?: { placeholder: string; maxLength: number };
};

type StepBase = {
  /** Key of the answer in the saved progress: keep it stable once shipped. */
  id: string;
  /** The step is only shown when this returns true (branch on an earlier answer). */
  when?: (answers: OnboardingAnswers) => boolean;
};

/** One answer. Advances on tap, unless an option has a note or a field: then "Continuer" confirms it. */
export type SingleChoiceStep = StepBase & {
  type: "single-choice";
  title: string;
  subtitle?: string;
  options: OnboardingOption[];
};

/** Several answers allowed, confirmed with "Continuer"; options shown as a grid of cards. */
export type MultiChoiceStep = StepBase & {
  type: "multi-choice";
  title: string;
  subtitle?: string;
  options: OnboardingOption[];
  /** Options replaced depending on the answer to an earlier step. */
  optionsBy?: { step: string; options: Record<string, OnboardingOption[]> };
  /** Option added after the others, full width (its field lets the visitor write the answer). */
  other?: OnboardingOption;
};

/** How the stop picked on a slider is shown. */
export type SliderDisplay =
  | { kind: "euros"; unit: string }
  /** One word per stop, with a sentence under it. */
  | { kind: "words"; words: string[]; sentences: string[] };

/** A value picked on a big slider, confirmed with "Continuer". */
export type SliderStep = StepBase & {
  type: "slider";
  title: string;
  subtitle?: string;
  /** Values the slider stops on, ascending. */
  values: number[];
  defaultValue: number;
  display: SliderDisplay;
  /** Word and note under the slider: the first tier whose `upTo` is at least the value. */
  tiers?: { upTo: number; word: string; note: string }[];
};

/** A number picked on a wheel (age), confirmed with "Valider". */
export type WheelStep = StepBase & {
  type: "wheel";
  title: string;
  subtitle?: string;
  min: number;
  max: number;
  defaultValue: number;
  /** Next to the picked number ("ans"). */
  unit: string;
  /** Read instead of the lowest number ("12 ou moins"). */
  firstLabel?: string;
  /** Under `value`, the answer is refused with this message instead of moving on. */
  minimum?: { value: number; title: string; text: string; action: string };
};

/** A written answer (first name, a sentence). */
export type TextStep = StepBase & {
  type: "text";
  title: string;
  subtitle?: string;
  placeholder: string;
  maxLength: number;
  /** Several lines instead of one. */
  multiline?: boolean;
  /** Can be skipped ("Passer cette étape"). */
  optional?: boolean;
  autoComplete?: string;
  cta?: string;
};

/** Question popping up during a loading screen: the loading waits for the answer. */
export type QuickQuestion = {
  /** Key of the answer in the saved progress. */
  id: string;
  /** Share of the loading (0 to 1) at which it pops up. */
  at: number;
  question: string;
  detail?: string;
  options: { value: string; label: string }[];
  when?: (answers: OnboardingAnswers) => boolean;
};

/** Loading screen paced on the clock (nothing is computed), with quick questions on the way.
 *  `{prenom}` and `{objectif}` in the texts are replaced by the visitor's answers. */
export type LoadingStep = StepBase & {
  type: "loading";
  title: string;
  subtitle?: string;
  /** What the loading goes through, one line at a time. */
  lines: string[];
  doneTitle: string;
  doneText: string;
  questions: QuickQuestion[];
  cta?: string;
  /** Moves on by itself once done, instead of waiting for "Continuer". */
  autoAdvance?: boolean;
};

/** Explainer screen: a kicker, a title, an animated illustration (MessageVisuals.tsx) or else an icon
 *  above the title, then a short text or a few points. `**bold**` is highlighted, `\n` breaks the line. */
export type MessageStep = StepBase & {
  type: "message";
  kicker: string;
  title: string;
  visual?: "recurring";
  /** Shown above the kicker on a screen without illustration. */
  icon?: LucideIcon;
  body?: string;
  /** Key points, each under its icon, two per row. */
  points?: { icon: LucideIcon; text: string }[];
};

/** Short exchange with the coach, like the coach's chat at the end, played in order: the visitor's
 *  lines pop in, the coach's come after typing dots. `**bold**` is highlighted, `{prenom}` and
 *  `{objectif}` are filled from the answers. */
export type ChatStep = StepBase & {
  type: "chat";
  messages: { from: "you" | "coach"; text: string }[];
  /** Moves on by itself once the answer had time to be read (the button still lets the visitor skip). */
  autoAdvance?: boolean;
  /** Label of the button (default "Suivant"). */
  cta?: string;
};

/** One sentence alone on screen, between two parts of the questions. */
export type StatementStep = StepBase & { type: "statement"; title: string };

/** What the product does, said by the coach, one slide per screen (`{prenom}`, `{objectif}`, `{reveFin}`
 *  filled from the answers). */
export type FeaturesStep = StepBase & {
  type: "features";
  slides: { title: string; body: string }[];
};

/** The plan being written live, paused by quick questions, then the plan sheet. */
export type BuildStep = StepBase & { type: "build"; questions: QuickQuestion[] };

/** Screens without a question, built on the answers: just a button to move on. */
export type InfoStep = StepBase & {
  type:
    | "social-proof"
    | "account"
    | "founder-profile"
    | "potential"
    | "method"
    | "future"
    | "stories"
    | "curve"
    | "one-thing"
    | "pact"
    | "coach-chat"
    | "projection";
};

export type OnboardingStep =
  | SingleChoiceStep
  | MultiChoiceStep
  | SliderStep
  | WheelStep
  | TextStep
  | LoadingStep
  | MessageStep
  | ChatStep
  | StatementStep
  | FeaturesStep
  | BuildStep
  | InfoStep;

/** Detail written in the field of an option ("Autre", passion...). */
export const detailKey = (stepId: string) => `${stepId}-detail`;

// The service is reserved to adults (CGU, article "Accès au service").
const MINIMUM_AGE = 18;

/** "Autre" option of a question: the answer is written in its card. */
const other = (placeholder: string): OnboardingOption => ({
  value: "autre",
  label: "Autre",
  icon: PenLine,
  free: { placeholder, maxLength: 120 },
});

const PASSION_MORE = "Tu peux nous en dire plus ? (optionnel)";

/** Branch questions asked after "experience", one per answer. */
const experienceIs = (value: string) => (answers: OnboardingAnswers) =>
  // Until "experience" is answered, the "never" branch counts: the step count stays the same.
  (typeof answers.experience === "string" ? answers.experience : "jamais") === value;

/** Labels of the options, by step and value (profile, potential, goal screens). */
export function optionLabel(stepId: string, value: unknown): string | undefined {
  const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
  if (!step || typeof value !== "string") return undefined;
  if (step.type === "single-choice") return step.options.find((o) => o.value === value)?.label;
  if (step.type === "multi-choice") {
    const all = [...step.options, ...Object.values(step.optionsBy?.options ?? {}).flat(), ...(step.other ? [step.other] : [])];
    return all.find((o) => o.value === value)?.label;
  }
  return undefined;
}

/**
 * Onboarding screens, in order (same questions as the FirstMRR funnel). The progress bar and the
 * saved progress follow this list, so adding a step here is all it takes.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  // --- Ta situation ---
  {
    id: "age",
    type: "wheel",
    title: "Tu as quel âge ?",
    min: 12,
    max: 99,
    defaultValue: 20,
    unit: "ans",
    firstLabel: "12 ou moins",
    minimum: {
      value: MINIMUM_AGE,
      title: `${LEGAL.siteName} est réservé aux ${MINIMUM_AGE} ans et plus.`,
      text: "Reviens nous voir dans quelques années, on t'attend.",
      action: "Corriger mon âge",
    },
  },
  {
    id: "profil",
    type: "single-choice",
    title: "Aujourd'hui, qu'est-ce que tu fais dans la vie ?",
    options: [
      {
        value: "etudiant",
        label: "Étudiant",
        icon: GraduationCap,
        note: "Tu as un vrai avantage : du temps, et presque rien à perdre. Beaucoup ont lancé leur premier projet pendant leurs études.",
      },
      {
        value: "salarie",
        label: "Salarié",
        icon: Briefcase,
        note: "Ton salaire tombe chaque mois, du coup tu peux lancer ton projet à côté sans aucune pression.",
      },
      {
        value: "freelance",
        label: "Indépendant",
        icon: Laptop,
        note: "Tu sais déjà trouver des clients. Une app peut te rapporter sans que tu vendes ton temps.",
      },
      { value: "autre", label: "Autre", icon: Compass, note: "Peu importe d'où tu pars, ton plan s'adapte à ta situation." },
    ],
  },
  {
    id: "frustrations",
    type: "multi-choice",
    title: "Qu'est-ce qui t'énerve le plus dans ta situation ?",
    subtitle: "Choisis-en autant que tu veux.",
    options: [
      { value: "a_temps", label: "Je n'ai pas de temps", icon: Clock, note: "On construira ton plan autour du peu de temps que tu as." },
      { value: "a_argent", label: "Je n'ai pas d'argent", icon: Wallet, note: "Bonne nouvelle : lancer une app ne demande ni stock ni budget pub." },
      { value: "a_stagne", label: "Je ne sais pas quoi faire", icon: CircleHelp, note: "Tu sauras quoi faire chaque jour, c'est le principe de ton plan." },
      { value: "a_autres", label: "Je veux être libre", icon: Bird, note: "Un revenu qui tombe chaque mois, c'est exactement ce qui rend libre." },
    ],
    optionsBy: {
      step: "profil",
      options: {
        etudiant: [
          { value: "e_argent", label: "Je n'ai pas d'argent", icon: Wallet, note: "Bonne nouvelle : lancer une app ne demande ni stock ni budget pub." },
          { value: "e_cours", label: "Je ne sais pas quoi faire", icon: CircleHelp, note: "Tu sauras quoi faire chaque jour, c'est le principe de ton plan." },
          { value: "e_temps", label: "Je n'ai pas de temps", icon: Clock, note: "Ton plan rentre entre tes cours, une tâche à la fois." },
          { value: "e_avance", label: "Je ne sais pas par où commencer", icon: Compass, note: "C'est exactement ce qu'on règle : on te donne la première étape." },
        ],
        salarie: [
          { value: "s_plafond", label: "Mon salaire est trop bas", icon: TrendingDown, note: "Un projet à côté, c'est le seul revenu qui n'a pas de plafond." },
          { value: "s_repet", label: "Je n'aime pas mon travail", icon: Frown, note: "Ton projet peut devenir la porte de sortie, à ton rythme." },
          { value: "s_temps", label: "Je n'ai pas de temps", icon: Clock, note: "Ton plan rentre dans tes soirées, une tâche à la fois." },
          { value: "s_patron", label: "Je veux plus de liberté", icon: Bird, note: "Un revenu à toi, c'est ce qui te rend libre de choisir." },
        ],
        freelance: [
          { value: "i_temps", label: "Je n'ai pas assez de clients", icon: Users, note: "Une app vend même quand tu ne prospectes pas." },
          { value: "i_irreg", label: "Je ne gagne pas assez", icon: Coins, note: "Un abonnement, c'est un revenu qui revient chaque mois." },
          { value: "i_seul", label: "Je suis seul", icon: UserRound, note: "Ton coach connaît ton projet et avance avec toi." },
          { value: "i_taches", label: "Je travaille trop", icon: BatteryLow, note: "Une app travaille pour toi, même quand tu dors." },
        ],
      },
    },
    other: other("Ex : je n'apprends plus rien…"),
  },
  // Member count said for the visitor's situation, echoing what annoys them.
  { id: "social-proof", type: "social-proof" },
  {
    id: "experience",
    type: "single-choice",
    title: "Tu as déjà lancé un business en ligne ?",
    options: [
      {
        value: "jamais",
        label: "Non, jamais",
        icon: Sprout,
        note: "Tant mieux : tu n'as aucune mauvaise habitude à défaire, et tu apprends direct la bonne méthode.",
      },
      {
        value: "en-cours",
        label: "Je suis en train de le lancer",
        icon: Hammer,
        note: "Le plus dur, c'est de commencer, et tu l'as fait. On t'aide à aller jusqu'au lancement.",
      },
      {
        value: "abandon",
        label: "Oui, mais j'ai abandonné",
        icon: Undo2,
        note: "Tu as déjà osé te lancer, alors que la plupart des gens ne l'ont jamais fait.",
      },
      {
        value: "vendu",
        label: "Oui, j'ai déjà eu des clients",
        icon: HandCoins,
        note: "Le plus dur est fait : quelqu'un t'a déjà payé. On va rendre ça régulier.",
      },
      { value: "tourne", label: "Oui, il tourne encore", icon: Rocket, note: "Alors on va t'aider à le faire grandir, chaque semaine un peu plus." },
    ],
  },
  {
    id: "pq-jamais",
    type: "single-choice",
    when: experienceIs("jamais"),
    title: "Pourquoi tu n'as jamais lancé de business ?",
    options: [
      {
        value: "idee",
        label: "Je ne sais pas quoi lancer",
        icon: Lightbulb,
        note: "Pas besoin d'avoir une idée pour commencer : on te propose des idées prêtes, choisies pour toi.",
      },
      { value: "peur", label: "J'ai peur d'échouer", icon: ShieldAlert, note: "C'est normal. Tu avances par petits pas, du coup tu ne risques jamais gros." },
      { value: "temps", label: "Je n'ai pas le temps", icon: Clock, note: "Ton plan s'adapte au temps que tu as, même si c'est une heure par jour." },
      { value: "depart", label: "Je ne sais pas par où commencer", icon: Compass, note: "C'est exactement ce qu'on règle : chaque jour, tu sais quoi faire." },
      other("Ex : je n'ose pas en parler autour de moi…"),
    ],
  },
  {
    id: "pq-en-cours",
    type: "single-choice",
    when: experienceIs("en-cours"),
    title: "Qu'est-ce qui te bloque pour le lancer ?",
    options: [
      { value: "finir", label: "Je n'arrive pas à le finir", icon: Puzzle, note: "On découpe ce qui reste en petites étapes, une seule à la fois." },
      {
        value: "clients",
        label: "Je ne sais pas qui va l'acheter",
        icon: Users,
        note: "On t'aide à trouver tes premiers clients avant même le lancement.",
      },
      { value: "temps", label: "Je n'ai pas le temps", icon: Clock, note: "Ton plan rentre dans le temps que tu as, une tâche à la fois." },
      { value: "peur", label: "J'ai peur de le montrer", icon: EyeOff, note: "C'est normal. On le teste d'abord avec quelques personnes, sans rien risquer." },
      other("Ex : je ne sais pas quel prix mettre…"),
    ],
  },
  {
    id: "pq-abandon",
    type: "single-choice",
    when: experienceIs("abandon"),
    title: "Pourquoi tu as abandonné ?",
    options: [
      { value: "temps", label: "Je n'avais pas le temps", icon: Clock, note: "Cette fois, ton plan rentre dans tes journées, avec une seule tâche à la fois." },
      { value: "clients", label: "Je n'avais pas de clients", icon: Users, note: "Trouver tes premiers clients fait partie du plan, étape par étape." },
      {
        value: "motivation",
        label: "J'ai perdu la motivation",
        icon: BatteryLow,
        note: "Seul, c'est dur de tenir. Avec un coach qui te relance quand tu décroches, beaucoup moins.",
      },
      { value: "complique", label: "C'était trop compliqué", icon: Puzzle, note: "On découpe tout en petites étapes, avec des mots simples." },
      other("Ex : je n'ose pas en parler autour de moi…"),
    ],
  },
  {
    id: "pq-vendu",
    type: "single-choice",
    when: experienceIs("vendu"),
    title: "Qu'est-ce qui te manque pour aller plus loin ?",
    options: [
      { value: "reguliers", label: "Des clients réguliers", icon: Repeat, note: "Tu sais déjà vendre. Maintenant, on rend ça régulier." },
      { value: "systeme", label: "Un système clair", icon: Workflow, note: "Chaque semaine, tu sauras quoi faire et dans quel ordre." },
      { value: "temps", label: "Du temps", icon: Clock, note: "On garde seulement les tâches qui rapportent." },
      { value: "offre", label: "Une meilleure offre", icon: Tag, note: "On retravaille ce que tu vends, avec toi." },
      other("Ex : je n'ose pas en parler autour de moi…"),
    ],
  },
  {
    id: "pq-tourne",
    type: "single-choice",
    when: experienceIs("tourne"),
    title: "Qu'est-ce qui te freine sur ton projet ?",
    options: [
      { value: "clients", label: "Trouver des clients", icon: Users, note: "On t'aide à savoir où les trouver, et quoi leur dire." },
      { value: "temps", label: "Le manque de temps", icon: Clock, note: "On garde seulement ce qui fait grandir ton projet." },
      { value: "ameliorer", label: "Je ne sais pas quoi améliorer", icon: Wrench, note: "Ton coach regarde ton projet et te dit quoi changer en premier." },
      { value: "seul", label: "Je suis seul", icon: UserRound, note: "Ton coach connaît ton projet, et il répond dès que tu bloques." },
      other("Ex : je n'ose pas en parler autour de moi…"),
    ],
  },
  {
    id: "echeance",
    type: "single-choice",
    title: "D'ici combien de temps ça doit marcher ?",
    options: [
      { value: "aujourdhui", label: "Aujourd'hui", icon: Zap, note: "Alors on commence aujourd'hui : ta première tâche t'attend dès que ton plan est prêt." },
      { value: "1sem", label: "1 semaine", icon: CalendarDays, note: "Une semaine, c'est assez pour poser les bases de ton projet." },
      { value: "2sem", label: "2 semaines", icon: CalendarRange, note: "Deux semaines, c'est un bon rythme pour avancer sans te griller." },
      { value: "1mois", label: "1 mois", icon: CalendarClock, note: "Un mois, c'est le temps de construire quelque chose de solide." },
    ],
  },
  {
    id: "passion",
    type: "single-choice",
    title: "Qu'est-ce qui te passionne ?",
    options: [
      {
        value: "sport",
        label: "Le sport",
        icon: Dumbbell,
        input: { label: PASSION_MORE, placeholder: "Ex. le foot, la muscu, le padel…", maxLength: 80, optional: true },
      },
      {
        value: "jeux-video",
        label: "Les jeux vidéo",
        icon: Gamepad2,
        input: { label: PASSION_MORE, placeholder: "Ex. Fortnite, FIFA, les jeux de stratégie…", maxLength: 80, optional: true },
      },
      {
        value: "vetements",
        label: "Les vêtements",
        icon: Shirt,
        input: { label: PASSION_MORE, placeholder: "Ex. le streetwear, les sneakers, la friperie…", maxLength: 80, optional: true },
      },
      {
        value: "business-tech",
        label: "Le business et la tech",
        icon: Cpu,
        input: { label: PASSION_MORE, placeholder: "Ex. l'IA, la bourse, l'immobilier…", maxLength: 80, optional: true },
      },
      {
        value: "autre",
        label: "Autre chose",
        icon: Ellipsis,
        input: { label: "Dis-nous ce qui te passionne", placeholder: "Ex. la cuisine, la musique, les voitures…", maxLength: 80 },
      },
    ],
  },
  {
    id: "prenom",
    type: "text",
    title: "Au fait, comment tu t'appelles ?",
    placeholder: "Ton prénom",
    maxLength: 40,
    autoComplete: "given-name",
  },

  // --- Analyse de ta situation ---
  {
    id: "analyse",
    type: "loading",
    title: "Analyse de ta situation",
    lines: ["J'analyse ta situation", "J'identifie ton profil", "Je calcule ton potentiel", "Je prépare ton plan"],
    doneTitle: "Analyse terminée",
    doneText: "Ton profil d'entrepreneur est prêt.",
    autoAdvance: true,
    questions: [
      {
        id: "satisfaction",
        at: 0.3,
        question: "Tu es satisfait de ta situation actuelle ?",
        options: [
          { value: "oui", label: "Oui, à 100 %" },
          { value: "pas-vraiment", label: "Pas vraiment" },
          { value: "non", label: "Non, ça doit changer" },
        ],
      },
      {
        id: "changement",
        at: 0.65,
        when: (answers) => answers.satisfaction !== "oui",
        question: "Tu sais comment changer ça ?",
        options: [
          { value: "non", label: "Non, pas vraiment" },
          { value: "idees", label: "J'ai des idées" },
          { value: "plan", label: "Oui, j'ai un plan" },
        ],
      },
      {
        id: "merite",
        at: 0.65,
        when: (answers) => answers.satisfaction === "oui",
        question: "Tu gagnes ce que tu mérites ?",
        options: [
          { value: "oui", label: "Oui, largement" },
          { value: "pas-encore", label: "Pas encore" },
          { value: "non", label: "Non" },
        ],
      },
    ],
  },
  // Built on the answers so far: strengths, weaknesses, potential, missing method.
  { id: "profil-entrepreneur", type: "founder-profile" },
  { id: "potentiel", type: "potential" },
  { id: "methode", type: "method" },
  // "Sauvegarde ta progression": the account is created here, right after the diagnosis.
  { id: "compte", type: "account" },

  // --- Comprendre : une app qu'on paie chaque mois ---
  // ⚠️ Chiffres et sources repris de FirstMRR (marché 2025, Bpifrance) : à vérifier avant la mise en ligne.
  {
    id: "saas-quoi",
    type: "chat",
    autoAdvance: true,
    messages: [
      { from: "you", text: "C'est quoi le business ?" },
      { from: "coach", text: "On va lancer un SaaS." },
      { from: "coach", text: "Une app ou un site que les gens paient pour l'utiliser." },
      { from: "coach", text: "Je te montre, {prenom}." },
    ],
  },
  {
    id: "saas-marche",
    type: "message",
    kicker: "Le marché",
    title: "Plus de 450 milliards de dollars en 2025.",
    icon: ChartNoAxesCombined,
    body: "Le monde a dépensé ça en logiciels l'an dernier. **0,00022 %** suffit pour faire **1 million de dollars.**",
  },
  {
    id: "saas-modele",
    type: "message",
    kicker: "Le modèle",
    title: "Tu le crées une fois, tu le vends sans limite.",
    visual: "recurring",
    points: [
      { icon: Repeat, text: "**Revenus récurrents** par abonnement." },
      { icon: PackageX, text: "**Pas de stock**, ni boutique, ni livraison." },
      { icon: Trophy, text: "**Business n°1 en 2026** (Bpifrance)." },
      { icon: Handshake, text: "Tu peux **le revendre** plus tard." },
    ],
  },
  {
    id: "saas-maintenant",
    type: "message",
    kicker: "Le bon moment",
    title: "Pourquoi c'est une opportunité en 2026.",
    icon: Rocket,
    body: "Avant, il fallait des mois et des milliers d'euros. Aujourd'hui, grâce à l'IA, tes **premiers revenus arrivent vite**, pour **quelques euros**.",
  },
  { id: "finaliser", type: "statement", title: "Pour finaliser ton plan, parle-moi de tes objectifs." },

  // --- Ton rêve et ton objectif ---
  {
    id: "vie",
    type: "multi-choice",
    title: "Quel est ton rêve ultime ?",
    subtitle: "Choisis-en autant que tu veux.",
    options: [
      { value: "riche", label: "Devenir riche", icon: Gem, note: "Imagine : partir en vacances quand tu veux, et ne plus compter à chaque dépense." },
      { value: "parents", label: "Rendre mes parents fiers", icon: Heart, note: "Imagine leur regard le jour où tu leur montres ce que tu as construit." },
      { value: "acheter", label: "M'acheter tout ce que je veux", icon: ShoppingBag, note: "Imagine : ne plus regarder le prix avant d'acheter." },
      { value: "prouver", label: "Prouver que j'en suis capable", icon: Trophy, note: "Imagine : leur montrer que tu l'as fait." },
    ],
    other: other("Ex : pouvoir m'occuper de mes parents…"),
  },
  {
    id: "perseverance",
    type: "slider",
    title: "À quel point tu as envie d'y arriver ?",
    values: [1, 2, 3, 4, 5],
    defaultValue: 3,
    display: {
      kind: "words",
      words: ["Curieux", "Intéressé", "Motivé", "Déterminé", "Rien ne m'arrête"],
      sentences: [
        "Tu veux voir si c'est pour toi.",
        "Tu as envie, mais tu hésites encore.",
        "Tu es prêt à te mettre au travail.",
        "Tu veux des résultats, et tu es prêt à bosser pour.",
        "Tu veux réussir, et tu iras jusqu'au bout.",
      ],
    },
  },
  {
    id: "frein",
    type: "single-choice",
    title: "Qu'est-ce qui t'empêche d'y arriver ?",
    options: [
      {
        value: "methode",
        label: "Le manque de méthode",
        icon: Route,
        note: `C'est pour ça que ${LEGAL.siteName} existe. Une méthode s'apprend en quelques jours.`,
      },
      {
        value: "concentration",
        label: "J'ai du mal à me concentrer",
        icon: Brain,
        note: "Ton plan sera découpé en tâches courtes : une seule chose à faire à la fois.",
      },
      { value: "essaie", label: "J'essaie, mais je n'y arrive pas", icon: RotateCcw, note: "Ce n'est pas l'effort qui te manque, c'est l'endroit où le mettre." },
      { value: "commence", label: "Je commence tout juste", icon: Sprout, note: "Tu es sur la bonne voie." },
      other("Ex : je n'ai personne autour de moi qui fait ça…"),
    ],
  },
  {
    id: "revenu",
    type: "slider",
    title: "Combien tu veux gagner par mois ?",
    subtitle: "Fais glisser pour fixer ton objectif.",
    // 1 000 € to 100 000 €, 10 000 € in the middle: steps of 500 € up to 10 000 €, then 2 000 €
    // up to 30 000 €, then 10 000 €.
    values: [
      ...Array.from({ length: 19 }, (_, i) => 1000 + i * 500),
      ...Array.from({ length: 10 }, (_, i) => 12000 + i * 2000),
      ...Array.from({ length: 7 }, (_, i) => 40000 + i * 10000),
    ],
    defaultValue: 5000,
    display: { kind: "euros", unit: "par mois" },
    tiers: [
      {
        upTo: 3000,
        word: "Réaliste",
        note: "Bel objectif, tout à fait réalisable. On te construit la roadmap pour l'atteindre, puis tu pourras viser plus haut.",
      },
      { upTo: 8000, word: "Accessible", note: "Super objectif. On met tout en place pour que tu l'atteignes : ta roadmap, ton coach, chaque étape." },
      { upTo: 20000, word: "Ambitieux", note: "Ça, c'est de l'ambition. Ta roadmap sera construite pour ce chiffre, et on t'accompagne jusqu'au bout." },
      { upTo: 50000, word: "Très ambitieux", note: "Gros objectif, et c'est comme ça qu'il faut viser. On te prépare tout le chemin, palier par palier." },
      {
        upTo: Number.POSITIVE_INFINITY,
        word: "Hors norme",
        note: "Là, tu vises tout en haut. On découpe ce chiffre en paliers, et ta roadmap te fait passer chacun d'eux.",
      },
    ],
  },
  {
    id: "time",
    type: "single-choice",
    title: "Tu peux y consacrer combien d'heures par semaine ?",
    options: [
      { value: "low", label: "Moins de 10 h", icon: Hourglass, note: "On organisera ton travail pour que chaque heure compte." },
      { value: "mid", label: "10 à 20 h", icon: Timer, note: "Super rythme : assez pour avancer chaque semaine, sans t'épuiser." },
      { value: "high", label: "20 à 40 h", icon: Zap, note: "Tu peux t'y mettre à fond. On remplira tes semaines avec ce qui compte le plus." },
      { value: "max", label: "Plus de 40 h", icon: Flame, note: "C'est un vrai temps plein. Ton plan sera précis, jour par jour." },
    ],
  },
  {
    id: "phrase",
    type: "text",
    title: "Décris en une phrase la situation où tu veux être dans un an.",
    placeholder: "Ex : je veux un premier client qui paie, et savoir que ça marche pour oser en faire plus.",
    maxLength: 240,
    multiline: true,
    optional: true,
    cta: "Valider",
  },

  // --- Ce qui t'attend ---
  {
    id: "fonctions",
    type: "features",
    // Said by the coach, under his face.
    slides: [
      {
        title: `Bienvenue dans ${LEGAL.siteName}, {prenom}.`,
        body: `Moi, c'est ${COACH_NAME}, ton coach. Je t'accompagne étape par étape vers ton objectif de **{objectif} par mois**.`,
      },
      {
        title: "Tout ce dont tu as besoin, au même endroit.",
        body: "Je te donne les conseils, les outils et ta roadmap pour atteindre **{objectif}/mois**.",
      },
      {
        title: "Regarde l'IA faire le plus dur à ta place.",
        body: "Je te prépare une roadmap étape par étape pour **atteindre tes objectifs**, et les meilleurs logiciels pour créer ton site.",
      },
      { title: "Change ta vie.", body: "{reveFin}" },
    ],
  },
  { id: "futur", type: "future" },
  { id: "preuves", type: "stories" },

  // --- L'engagement ---
  { id: "courbe", type: "curve" },
  { id: "seule", type: "one-thing" },
  { id: "pacte", type: "pact" },

  // --- Ton plan ---
  { id: "construire", type: "coach-chat" },
  {
    id: "construction",
    type: "build",
    questions: [
      {
        id: "action",
        at: 0.3,
        question: "Es-tu vraiment prêt à passer à l'action ?",
        detail: "Parce que ton plan commence aujourd'hui, pas lundi prochain.",
        options: [
          { value: "oui", label: "Oui" },
          { value: "non", label: "Non" },
        ],
      },
      {
        id: "investir",
        at: 0.65,
        question: "Es-tu prêt à investir sur toi-même ?",
        detail: "Moins cher qu'un resto par mois, et c'est ton avenir qui en profite.",
        options: [
          { value: "oui", label: "Oui" },
          { value: "non", label: "Non" },
        ],
      },
    ],
  },
  // Last screen before the paywall.
  { id: "projection", type: "projection" },
];

