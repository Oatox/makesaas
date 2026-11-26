import { useEffect, useRef } from "react";
import { ANALYTICS_EVENTS, ONBOARDING_PROPERTY_PREFIX } from "@shared/analytics";
import { setUserProperties, track } from "@/lib/analytics";
import type { OnboardingAnswers } from "@/lib/onboarding-storage";
import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";

/**
 * The answers of a screen sent to Amplitude (user properties `onboarding_<id>`), by id: those picked
 * among options (and the quick questions of the loading screens), numbers for the sliders and wheels.
 * Written answers (first name, the member's sentence, the "Autre" fields) never leave. The admin's
 * Onboarding page reads them back (client/src/components/admin/onboarding/screen-questions.ts).
 */
export function sentAnswers(step: OnboardingStep): [string, "option" | "number"][] {
  if (step.type === "single-choice" || step.type === "multi-choice") return [[step.id, "option"]];
  if (step.type === "slider" || step.type === "wheel") return [[step.id, "number"]];
  if ("questions" in step) return step.questions.map((question): [string, "option"] => [question.id, "option"]);
  return [];
}

const SENT_ANSWERS = new Map<string, "option" | "number">(ONBOARDING_STEPS.flatMap(sentAnswers));

/**
 * The onboarding in Amplitude: each screen shown (the funnel, in the order of the screens), its end,
 * and the answers as user properties (`onboarding_<step>`), to split the funnel by profile.
 */
export function useOnboardingAnalytics(steps: OnboardingStep[], stepIndex: number, answers: OnboardingAnswers, enabled: boolean) {
  const step = steps[stepIndex] as OnboardingStep | undefined;
  const screen = step?.id ?? (stepIndex >= steps.length ? "done" : null);

  // Once per screen shown (again when coming back to it), not when the steps after it change.
  const latest = useRef({ step, stepIndex, count: steps.length });
  latest.current = { step, stepIndex, count: steps.length };
  useEffect(() => {
    if (!enabled || !screen) return;
    const { step, stepIndex, count } = latest.current;
    if (step) {
      // `step` labels the screen for charts: its number on two digits first, so that a sort as text
      // keeps the screens in order ("04 social-proof" before "10 analyse").
      const step_label = `${String(stepIndex + 1).padStart(2, "0")} ${step.id}`;
      track(ANALYTICS_EVENTS.onboardingStepViewed, {
        step: step_label,
        step_id: step.id,
        step_type: step.type,
        step_number: stepIndex + 1,
        step_count: count,
      });
    } else {
      track(ANALYTICS_EVENTS.onboardingCompleted, { step_count: count });
    }
  }, [enabled, screen]);

  const sent = useRef<OnboardingAnswers>({});
  useEffect(() => {
    if (!enabled) return;
    const changed: Record<string, string | number | string[]> = {};
    for (const [key, kind] of Array.from(SENT_ANSWERS)) {
      const value = answers[key];
      if (value === undefined || value === sent.current[key]) continue;
      const number = kind === "number" && typeof value === "string" ? Number(value) : NaN;
      changed[ONBOARDING_PROPERTY_PREFIX + key] = Number.isFinite(number) ? number : value;
    }
    sent.current = answers;
    if (Object.keys(changed).length > 0) setUserProperties(changed);
  }, [enabled, answers]);
}
