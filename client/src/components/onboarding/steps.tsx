import {
  CalendarDays,
  CircleSlash,
  Coins,
  Dices,
  Flame,
  Gem,
  Globe,
  Goal,
  Heart,
  Layers,
  PiggyBank,
  ShieldCheck,
  Shuffle,
  Sprout,
  Target,
  TrendingDown,
  Trophy,
  Tv,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { leagueLogoUrl } from "@/lib/leagues";

export type OnboardingOption = {
  value: string;
  label: string;
  /** Icon shown before the label. */
  icon?: LucideIcon;
  /** Picture shown instead of the icon (competition crest...). */
  image?: string;
  /** Multiple choice only: excludes every other pick ("none of these"), shown full width under the grid. */
  exclusive?: boolean;
};

export type SingleChoiceStep = {
  /** Key of the answer in the saved progress: keep it stable once shipped. */
  id: string;
  type: "single-choice";
  title: string;
  subtitle?: string;
  options: OnboardingOption[];
};

/** Several answers allowed, confirmed with "Continuer"; options shown as a grid of cards. */
export type MultiChoiceStep = {
  id: string;
  type: "multi-choice";
  title: string;
  subtitle?: string;
  options: OnboardingOption[];
};

/** An amount picked on a big slider, confirmed with "Continuer". */
export type SliderStep = {
  id: string;
  type: "slider";
  title: string;
  subtitle?: string;
  /** Amounts the slider stops on, ascending. */
  values: number[];
  defaultValue: number;
  /** Shown under the amount ("par mois"...). */
  unit: string;
};

/** Screens without a question (social proof, insight on an answer...): just a "Continuer" button. */
export type InfoStep =
  | { id: string; type: "social-proof" }
  | { id: string; type: "betting-insight" }
  | { id: string; type: "goal-projection" }
  | { id: string; type: "profile-setup" };

export type OnboardingStep = SingleChoiceStep | MultiChoiceStep | SliderStep | InfoStep;

/**
 * Onboarding screens, in order. The progress bar and the saved progress follow this list,
 * so adding a step here is all it takes.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "football-level",
    type: "single-choice",
    title: "Quel est ton niveau en foot ?",
    options: [
      { value: "beginner", label: "Je découvre", icon: Sprout },
      { value: "casual", label: "Je suis les grands matchs", icon: Tv },
      { value: "fan", label: "Je suis un vrai supporter", icon: Heart },
      { value: "expert", label: "Je connais le foot par cœur", icon: Trophy },
    ],
  },
  {
    id: "betting-frequency",
    type: "single-choice",
    title: "À quelle fréquence fais-tu des paris sportifs ?",
    options: [
      { value: "daily", label: "Tous les jours", icon: Flame },
      { value: "several-per-week", label: "Plusieurs fois par semaine", icon: Zap },
      { value: "weekly", label: "Chaque week-end", icon: CalendarDays },
      { value: "few-per-month", label: "Quelques fois par mois", icon: Dices },
      { value: "never", label: "Jamais pour l'instant", icon: CircleSlash },
    ],
  },
  // Tailored to the answer just given to "betting-frequency".
  { id: "betting-insight", type: "betting-insight" },
  {
    id: "betting-winnings",
    type: "single-choice",
    title: "Combien as-tu déjà gagné grâce aux paris sportifs ?",
    options: [
      { value: "never-bet", label: "Je n'ai jamais parié", icon: CircleSlash },
      { value: "losing", label: "Je suis plutôt en perte", icon: TrendingDown },
      { value: "under-100", label: "Moins de 100 €", icon: PiggyBank },
      { value: "100-500", label: "Entre 100 € et 500 €", icon: Coins },
      { value: "over-500", label: "Plus de 500 €", icon: Gem },
    ],
  },
  {
    id: "betting-strategy",
    type: "single-choice",
    title: "Quelle stratégie de paris te ressemble le plus ?",
    options: [
      { value: "gut-feeling", label: "Au feeling, sans vraie stratégie", icon: Shuffle },
      { value: "value", label: "Je cherche les cotes mal placées", icon: Target },
      { value: "goals", label: "Je parie sur les buts (+2,5, BTTS)", icon: Goal },
      { value: "accumulators", label: "Je fais des combinés", icon: Layers },
      { value: "favourites", label: "Je joue les favoris en simple", icon: ShieldCheck },
    ],
  },
  { id: "social-proof", type: "social-proof" },
  {
    id: "competitions",
    type: "multi-choice",
    title: "Sur quelles compétitions veux-tu te concentrer ?",
    subtitle: "Choisis-en autant que tu veux.",
    options: [
      { value: "champions-league", label: "Ligue des champions", image: leagueLogoUrl(2) },
      { value: "ligue-1", label: "Ligue 1", image: leagueLogoUrl(61) },
      { value: "premier-league", label: "Premier League", image: leagueLogoUrl(39) },
      { value: "laliga", label: "LaLiga", image: leagueLogoUrl(140) },
      { value: "serie-a", label: "Serie A", image: leagueLogoUrl(135) },
      { value: "bundesliga", label: "Bundesliga", image: leagueLogoUrl(78) },
      { value: "europa-league", label: "Ligue Europa", image: leagueLogoUrl(3) },
      { value: "other", label: "Autres compétitions", icon: Globe },
      { value: "not-sure", label: "Je ne sais pas", exclusive: true },
    ],
  },
  {
    id: "winnings-goal",
    type: "slider",
    title: "Combien aimerais-tu gagner par mois ?",
    subtitle: "Fais glisser pour fixer ton objectif.",
    // 50 € to 5 000 €, in steps of 50 €.
    values: Array.from({ length: 100 }, (_, i) => (i + 1) * 50),
    defaultValue: 500,
    unit: "par mois",
  },
  // Built on the goal just picked on "winnings-goal".
  { id: "goal-projection", type: "goal-projection" },
  // Last screen: visitors then go to the sign-up page (an account is needed to subscribe).
  { id: "profile-setup", type: "profile-setup" },
];
