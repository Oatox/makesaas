import { useCallback, useState } from "react";
import {
  clearOnboardingProgress,
  emptyOnboardingProgress,
  loadOnboardingProgress,
  saveOnboardingProgress,
  type OnboardingProgress,
} from "@/lib/onboarding-storage";

/** Onboarding progress state, saved to localStorage with every change. */
export function useOnboardingProgress(stepCount: number) {
  const [progress, setProgress] = useState<OnboardingProgress>(() => {
    const saved = loadOnboardingProgress();
    // Steps may have been removed since the progress was saved: never point past the end.
    return { ...saved, stepIndex: Math.min(saved.stepIndex, stepCount) };
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

  /** Records the answer to a step and moves to the next one. */
  const answer = useCallback(
    (stepId: string, value: string | string[]) => {
      update((prev) => ({
        ...prev,
        answers: { ...prev.answers, [stepId]: value },
        stepIndex: Math.min(prev.stepIndex + 1, stepCount),
      }));
    },
    [stepCount, update],
  );

  /** Moves on from a screen that has no answer. */
  const next = useCallback(() => {
    update((prev) => ({ ...prev, stepIndex: Math.min(prev.stepIndex + 1, stepCount) }));
  }, [stepCount, update]);

  const back = useCallback(() => {
    update((prev) => ({ ...prev, stepIndex: Math.max(prev.stepIndex - 1, 0) }));
  }, [update]);

  const reset = useCallback(() => {
    clearOnboardingProgress();
    setProgress(emptyOnboardingProgress());
  }, []);

  return { progress, answer, next, back, reset };
}
