import { ONBOARDING_STEPS, type OnboardingStep } from "@/components/onboarding/steps";

const STEPS_BY_ID = new Map(ONBOARDING_STEPS.map((step) => [step.id, step]));

/** Screens without a title of their own (client/src/components/onboarding/steps.tsx), by type. */
const NAMES_BY_TYPE: Partial<Record<OnboardingStep["type"], string>> = {
  "social-proof": "Preuve sociale",
  account: "Création du compte",
  "founder-profile": "Profil d'entrepreneur",
  potential: "Son potentiel",
  method: "La méthode",
  future: "Son futur",
  stories: "Témoignages",
  curve: "Courbe de progression",
  "one-thing": "Une seule chose",
  pact: "Le pacte",
  "coach-chat": "Discussion avec Gus",
  projection: "Projection",
  chat: "Échange avec Gus",
  features: "Ce que fait l'app",
  build: "Construction du plan",
};

/** A step's title as plain text: no `**bold**`, no line breaks, the visitor's answers as "…". */
const plainTitle = (title: string) =>
  title
    .replace(/\*\*/g, "")
    .replace(/\{\w+\}/g, "…")
    .replace(/\s*\n\s*/g, " ")
    .trim();

/** What a screen of the onboarding shows, for the admin: its title, or what kind of screen it is. */
export function screenName(stepId: string): string {
  const step = STEPS_BY_ID.get(stepId);
  if (!step) return stepId;
  if ("title" in step && typeof step.title === "string") return plainTitle(step.title);
  return NAMES_BY_TYPE[step.type] ?? stepId;
}
