import { useCallback, useState } from "react";
import {
  clearOnboardingProgress,
  emptyOnboardingProgress,
  loadOnboardingProgress,
  saveOnboardingProgress,
  type OnboardingAnswers,
  type OnboardingProgress,
} from "@/lib/onboarding-storage";

/**
 * Onboarding progress state, saved to localStorage with every change. `stepCount` gives the number
 * of steps shown for some answers (steps can depend on earlier answers); keep it a stable function.
 */
export function useOnboardingProgress(stepCount: (answers: OnboardingAnswers) => number) {
  const [progress, setProgress] = useState<OnboardingProgress>(() => {
    const saved = loadOnboardingProgress();
    // Steps may have been removed since the progress was saved: never point past the end.
    return { ...saved, stepIndex: Math.min(saved.stepIndex, stepCount(saved.answers)) };
  });

  // Saved as part of the update, not in an effect: the page may be left right after (sign-up),
  // before an effect would run.
  const update = useCallback((change: (prev: OnboardingProgress) => OnboardingProgress) => {
    setProgress((prev) => {
      const next = change(prev);
      saveOnboardingProgress(next);
      return next;
    });
  }, []);

  /** Records the answer to a step (and the answers that come with it: written detail...) and moves to the next one. */
  const answer = useCallback(
    (stepId: string, value: string | string[], extra?: OnboardingAnswers) => {
      update((prev) => {
        const answers = { ...prev.answers, ...extra, [stepId]: value };
        return { ...prev, answers, stepIndex: Math.min(prev.stepIndex + 1, stepCount(answers)) };
      });
    },
    [stepCount, update],
  );

  /** Moves on from a screen that has no answer of its own (a loading screen may bring quick answers). */
  const next = useCallback(
    (extra?: OnboardingAnswers) => {
      update((prev) => {
        const answers = extra ? { ...prev.answers, ...extra } : prev.answers;
        return { ...prev, answers, stepIndex: Math.min(prev.stepIndex + 1, stepCount(answers)) };
      });
    },
    [stepCount, update],
  );

  /** Goes back `by` steps (to jump over a step that no longer applies). */
  const back = useCallback(
    (by = 1) => {
      update((prev) => ({ ...prev, stepIndex: Math.max(prev.stepIndex - by, 0) }));
    },
    [update],
  );

  const reset = useCallback(() => {
    clearOnboardingProgress();
    setProgress(emptyOnboardingProgress());
  }, []);

  return { progress, answer, next, back, reset };
}
