import type { LucideIcon } from "lucide-react";
import { sentAnswers } from "@/components/onboarding/analytics";
import { euros } from "@/components/onboarding/insights";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/components/onboarding/steps";
import { plainTitle } from "./screen-names";

/**
 * The questions of a screen of the onboarding as the admin's Onboarding page reads their answers back
 * from Amplitude (the `onboarding_<key>` user properties, client/src/components/onboarding/analytics.ts):
 * each answer's value in words, in the order the screen shows them.
 */

/** A possible answer: an option, or a range of numbers for a slider or a wheel. */
export type AnswerChoice = { key: string; label: string; icon?: LucideIcon };

export type ScreenQuestion = {
  /** The answer's id: the user property `onboarding_<key>`. */
  key: string;
  title: string;
  /** Several options at once: the shares add up to more than 100 %. */
  multiple: boolean;
  /** The possible answers, in the screen's order. */
  choices: AnswerChoice[];
  /** Only the answers picked are listed (options that depend on an earlier answer: too many to list them all). */
  pickedOnly: boolean;
  /** The choice a value Amplitude sends back falls in (a range for the numbers); undefined for a value no choice has. */
  choiceOf: (value: string) => string | undefined;
  /** A number answer: the median picked, in words. */
  median?: (values: { value: string; users: number }[]) => string | null;
};

const STEPS_BY_ID = new Map(ONBOARDING_STEPS.map((step) => [step.id, step]));

/** The upper ends of the age ranges the wheel's answers are grouped in (the wheel asks the age). */
const AGE_RANGES = [14, 17, 20, 24, 29, 39];

/** The median of answers counted by value (each visitor once per value). */
function medianOf(values: { value: string; users: number }[]): number | null {
  const numbers = values
    .map((entry) => ({ number: Number(entry.value), users: entry.users }))
    .filter((entry) => Number.isFinite(entry.number))
    .sort((a, b) => a.number - b.number);
  const total = numbers.reduce((sum, entry) => sum + entry.users, 0);
  if (!total) return null;
  let seen = 0;
  for (const entry of numbers) {
    seen += entry.users;
    if (seen >= total / 2) return entry.number;
  }
  return null;
}

/**
 * The options of a question as choices. The sets of options that depend on an earlier answer say the
 * same thing in different values ("Je n'ai pas d'argent", a student's or not): one choice per label,
 * at its first place.
 */
function optionChoices(step: Extract<OnboardingStep, { type: "single-choice" | "multi-choice" }>) {
  const options =
    step.type === "single-choice"
      ? step.options
      : [...step.options, ...Object.values(step.optionsBy?.options ?? {}).flat(), ...(step.other ? [step.other] : [])];
  const labelOf = new Map(options.map((option) => [option.value, option.label]));
  const choices = Array.from(new Map(options.map((option) => [option.label, { key: option.label, label: option.label, icon: option.icon }])).values());
  return {
    choices,
    pickedOnly: step.type === "multi-choice" && Boolean(step.optionsBy),
    choiceOf: (value: string) => labelOf.get(value),
  };
}

/** The question asked by a slider or a wheel: ranges or words for the numbers picked. */
function numberQuestion(step: Extract<OnboardingStep, { type: "slider" | "wheel" }>): ScreenQuestion {
  const base = { key: step.id, title: plainTitle(step.title), multiple: false, pickedOnly: false };

  if (step.type === "wheel") {
    const ranges = AGE_RANGES.filter((upTo) => upTo > step.min && upTo < step.max);
    const choices = [...ranges, step.max].map((upTo, index) => {
      const from = index === 0 ? null : ranges[index - 1] + 1;
      const label =
        from === null ? `${upTo} ${step.unit} ou moins` : index === ranges.length ? `${from} ${step.unit} et plus` : `${from} à ${upTo} ${step.unit}`;
      return { key: String(upTo), label };
    });
    return {
      ...base,
      choices,
      choiceOf: (value) => {
        const number = Number(value);
        if (!Number.isFinite(number)) return undefined;
        return String(ranges.find((upTo) => number <= upTo) ?? step.max);
      },
      median: (values) => {
        const median = medianOf(values);
        return median === null ? null : median <= step.min && step.firstLabel ? step.firstLabel : `${median} ${step.unit}`;
      },
    };
  }

  const display = step.display;
  if (display.kind === "words") {
    return {
      ...base,
      choices: step.values.map((value, index) => ({ key: String(value), label: display.words[index] ?? String(value) })),
      choiceOf: (value) => (step.values.includes(Number(value)) ? String(Number(value)) : undefined),
      median: (values) => {
        const median = medianOf(values);
        return median === null ? null : (display.words[step.values.indexOf(median)] ?? String(median));
      },
    };
  }

  // Amounts: grouped by the slider's tiers ("Réaliste", up to 3 000 €), else one choice per stop.
  const money = (value: number) => euros.format(value);
  const tiers: { upTo: number; word: string }[] = step.tiers ?? step.values.map((value) => ({ upTo: value, word: money(value) }));
  return {
    ...base,
    choices: tiers.map((tier, index) => {
      const from = index > 0 ? tiers[index - 1].upTo : null;
      const range = Number.isFinite(tier.upTo) ? `jusqu'à ${money(tier.upTo)}` : `plus de ${money(from ?? 0)}`;
      return { key: String(index), label: step.tiers ? `${tier.word} · ${range}` : tier.word };
    }),
    choiceOf: (value) => {
      const number = Number(value);
      if (!Number.isFinite(number)) return undefined;
      const index = tiers.findIndex((tier) => number <= tier.upTo);
      return index >= 0 ? String(index) : undefined;
    },
    median: (values) => {
      const median = medianOf(values);
      return median === null ? null : `${money(median)} ${display.unit}`;
    },
  };
}

/** The questions a screen asks whose answers Amplitude has, in the screen's order. */
export function screenQuestions(stepId: string): ScreenQuestion[] {
  const step = STEPS_BY_ID.get(stepId);
  if (!step) return [];
  const sent = new Set(sentAnswers(step).map(([key]) => key));

  const questions: ScreenQuestion[] = [];
  if (step.type === "single-choice" || step.type === "multi-choice") {
    questions.push({ key: step.id, title: plainTitle(step.title), multiple: step.type === "multi-choice", ...optionChoices(step) });
  } else if (step.type === "slider" || step.type === "wheel") {
    questions.push(numberQuestion(step));
  } else if (step.type === "loading" || step.type === "build") {
    for (const question of step.questions) {
      const choices = question.options.map((option) => ({ key: option.value, label: option.label }));
      questions.push({
        key: question.id,
        title: plainTitle(question.question),
        multiple: false,
        choices,
        pickedOnly: false,
        choiceOf: (value) => (choices.some((choice) => choice.key === value) ? value : undefined),
      });
    }
  }
  return questions.filter((question) => sent.has(question.key));
}

/** A written answer (first name, the member's sentence): it never reaches Amplitude. */
export const isWrittenAnswer = (stepId: string) => STEPS_BY_ID.get(stepId)?.type === "text";

/** A choice and the visitors who picked it (its share of those who answered). */
export type ChoiceCount = AnswerChoice & { users: number; share: number };

/**
 * The answers to a question counted per choice, in the screen's order: the values Amplitude sends back
 * grouped into their choice (a range for the numbers), the choices nobody picked kept (unless the
 * question lists only those picked), values no choice has (an option since removed) at the end.
 */
export function countChoices(question: ScreenQuestion, values: { value: string; users: number }[], respondents: number): ChoiceCount[] {
  const counts = new Map<string, number>();
  const unknown = new Map<string, number>();
  for (const { value, users } of values) {
    const choice = question.choiceOf(value);
    if (choice !== undefined) counts.set(choice, (counts.get(choice) ?? 0) + users);
    else unknown.set(value, (unknown.get(value) ?? 0) + users);
  }
  const share = (users: number) => (respondents ? Math.min(users / respondents, 1) : 0);
  return [
    ...question.choices
      .map((choice) => ({ ...choice, users: counts.get(choice.key) ?? 0 }))
      .filter((choice) => !question.pickedOnly || choice.users > 0),
    ...Array.from(unknown, ([value, users]) => ({ key: `unknown:${value}`, label: value, users })),
  ].map((choice) => ({ ...choice, share: share(choice.users) }));
}
