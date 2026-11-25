import {
  ONBOARDING_ANSWER_MAX_LENGTH,
  ONBOARDING_PROFILE_MAX_LINES,
  ONBOARDING_QUESTION_MAX_LENGTH,
  type OnboardingProfile,
} from "@shared/onboarding-profile";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { euros, fillTemplate } from "./insights";
import { detailKey, ONBOARDING_STEPS, type OnboardingOption, type QuickQuestion } from "./steps";

// The onboarding answers in words, question by question, for the AI pipelines (shared/onboarding-profile.ts):
// the server never sees the steps, only these lines.

const plain = (value: string) => value.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const clip = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);

const textAnswer = (answers: OnboardingAnswers, key: string) => {
  const value = answers[key];
  return typeof value === "string" ? plain(value) : "";
};

/** Picked options in words: the written text replaces "Autre", a detail is added in brackets. */
function choiceAnswer(options: OnboardingOption[], values: string[], detail: string) {
  const picked = values.map((value) => options.find((option) => option.value === value));
  const labels = picked.map((option, index) => (option?.free ? detail || option.label : (option?.label ?? values[index])));
  const wroteFree = picked.some((option) => option?.free);
  const answer = labels.filter(Boolean).join(", ");
  return detail && !wroteFree ? `${answer} (${detail})` : answer;
}

function quickAnswers(questions: QuickQuestion[], answers: OnboardingAnswers) {
  return questions
    .filter((question) => !question.when || question.when(answers))
    .map((question) => {
      const value = textAnswer(answers, question.id);
      const label = question.options.find((option) => option.value === value)?.label;
      return { question: question.question, answer: label ?? "" };
    });
}

/** Every answered question of the onboarding, in order, with the answer as the visitor saw it. */
export function buildOnboardingProfile(answers: OnboardingAnswers): OnboardingProfile {
  const lines: { question: string; answer: string }[] = [];

  for (const step of ONBOARDING_STEPS) {
    if (step.when && !step.when(answers)) continue;
    const detail = textAnswer(answers, detailKey(step.id));

    switch (step.type) {
      case "single-choice": {
        const value = textAnswer(answers, step.id);
        if (value) lines.push({ question: step.title, answer: choiceAnswer(step.options, [value], detail) });
        break;
      }
      case "multi-choice": {
        const value = answers[step.id];
        const values = Array.isArray(value) ? value : [];
        if (!values.length) break;
        const shown = step.optionsBy ? (step.optionsBy.options[textAnswer(answers, step.optionsBy.step)] ?? step.options) : step.options;
        lines.push({ question: step.title, answer: choiceAnswer([...shown, ...(step.other ? [step.other] : [])], values, detail) });
        break;
      }
      case "slider": {
        const value = Number(textAnswer(answers, step.id));
        if (!textAnswer(answers, step.id) || !Number.isFinite(value)) break;
        const answer =
          step.display.kind === "euros"
            ? `${euros.format(value)} ${step.display.unit}`
            : (step.display.words[step.values.indexOf(value)] ?? String(value));
        lines.push({ question: step.title, answer });
        break;
      }
      case "wheel": {
        const value = Number(textAnswer(answers, step.id));
        if (!textAnswer(answers, step.id) || !Number.isFinite(value)) break;
        lines.push({ question: step.title, answer: value <= step.min && step.firstLabel ? step.firstLabel : `${value} ${step.unit}` });
        break;
      }
      case "text": {
        const value = textAnswer(answers, step.id);
        if (value) lines.push({ question: step.title, answer: value });
        break;
      }
      case "loading":
      case "build":
        lines.push(...quickAnswers(step.questions, answers));
        break;
    }
  }

  return lines
    .map(({ question, answer }) => ({
      question: clip(plain(fillTemplate(question, answers)), ONBOARDING_QUESTION_MAX_LENGTH),
      answer: clip(plain(answer), ONBOARDING_ANSWER_MAX_LENGTH),
    }))
    .filter(({ question, answer }) => question && answer)
    .slice(0, ONBOARDING_PROFILE_MAX_LINES);
}

// --- Reading the lines back (the member's page in the admin) ---

/** One picked option of an answer, with its icon; `written` when the member wrote it themself ("Autre"). */
export type ReadChoice = { label: string; icon?: OnboardingOption["icon"]; written?: boolean };

/** A saved line matched back to the step that asks it. */
export type ReadAnswer = {
  question: string;
  answer: string;
  /** Id of the step (or quick question) asking it; undefined once no step asks it anymore. */
  stepId?: string;
  /** The picked options of a choice, and the text written in an option's field ("Autre chose (Les animaux)"). */
  choices?: ReadChoice[];
  detail?: string;
  /** A slider in words: the rank of the word picked (1 to `max`). */
  level?: { value: number; max: number };
  /** Written by the member in their own words (a text step). */
  written?: boolean;
};

type AskedQuestion = { id: string; options?: OnboardingOption[]; words?: string[]; written?: boolean };

/** Every question the onboarding asks, by its title as saved in the lines. */
function askedQuestions(): Map<string, AskedQuestion> {
  const asked = new Map<string, AskedQuestion>();
  const add = (title: string, question: AskedQuestion) => asked.set(plain(title), question);
  const addQuick = (questions: QuickQuestion[]) => questions.forEach((q) => add(q.question, { id: q.id, options: q.options }));

  for (const step of ONBOARDING_STEPS) {
    switch (step.type) {
      case "single-choice":
        add(step.title, { id: step.id, options: step.options });
        break;
      case "multi-choice":
        add(step.title, {
          id: step.id,
          options: [...step.options, ...Object.values(step.optionsBy?.options ?? {}).flat(), ...(step.other ? [step.other] : [])],
        });
        break;
      case "slider":
        add(step.title, { id: step.id, words: step.display.kind === "words" ? step.display.words : undefined });
        break;
      case "wheel":
        add(step.title, { id: step.id });
        break;
      case "text":
        add(step.title, { id: step.id, written: true });
        break;
      case "loading":
      case "build":
        addQuick(step.questions);
        break;
    }
  }
  return asked;
}

/** Splits a choice answer back into its options: labels joined by ", ", the text written in "Autre"
 *  in place of its label, and an option's field in brackets at the end (see `choiceAnswer`). */
function readChoices(answer: string, options: OnboardingOption[]): Pick<ReadAnswer, "choices" | "detail"> {
  const labels = Array.from(new Set(options.map((option) => option.label))).sort((a, b) => b.length - a.length);
  const free = options.find((option) => option.free);
  const choices: ReadChoice[] = [];
  let detail: string | undefined;
  let rest = answer;

  while (rest) {
    const label = labels.find((l) => rest === l || rest.startsWith(`${l}, `) || rest.startsWith(`${l} (`));
    if (label) {
      choices.push({ label, icon: options.find((option) => option.label === label)?.icon });
      rest = rest.slice(label.length);
    } else {
      // Written in "Autre": up to the next option picked after it.
      const next = labels.map((l) => rest.indexOf(`, ${l}`)).filter((index) => index > 0);
      const end = next.length ? Math.min(...next) : rest.length;
      choices.push({ label: rest.slice(0, end), icon: free?.icon, written: true });
      rest = rest.slice(end);
    }
    if (rest.startsWith(", ")) rest = rest.slice(2);
    else if (rest.startsWith(" (") && rest.endsWith(")")) {
      detail = rest.slice(2, -1);
      rest = "";
    }
  }
  return { choices, detail };
}

/** The saved lines matched back to the onboarding's steps: which step, which options (with their icons). */
export function readOnboardingProfile(profile: OnboardingProfile): ReadAnswer[] {
  const asked = askedQuestions();
  return profile.map(({ question, answer }) => {
    const step = asked.get(question);
    if (!step) return { question, answer };
    const rank = step.words ? step.words.indexOf(answer) + 1 : 0;
    return {
      question,
      answer,
      stepId: step.id,
      ...(step.written ? { written: true } : {}),
      ...(step.options ? readChoices(answer, step.options) : {}),
      ...(step.words && rank > 0 ? { level: { value: rank, max: step.words.length } } : {}),
    };
  });
}
