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
