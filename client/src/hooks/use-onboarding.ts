import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { onboardingFinishedHere } from "@/components/onboarding/steps";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
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

/**
 * Whether the signed-in user went through the onboarding: to its end on this device, or on another
 * one (the paywall then saved their answers on their profile, profiles.onboarding_profile). Accounts
 * are created in it, but one can still be opened elsewhere (Google on the sign-in page): the paywall
 * sends those who never answered it back there. A profile that cannot be read does not block them.
 */
export function useOnboardingAnswered(): { answered: boolean; isLoading: boolean } {
  const { user } = useAuth();
  const [finishedHere] = useState(onboardingFinishedHere);
  const query = useQuery({
    queryKey: ["onboarding-answered", user?.id],
    enabled: !!user && !finishedHere,
    queryFn: async () => {
      // The first answer is enough to know there are some.
      const { data, error } = await supabase.from("profiles").select("first:onboarding_profile->0").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data?.first != null;
    },
    staleTime: Infinity,
  });

  if (finishedHere) return { answered: true, isLoading: false };
  return { answered: query.isError || query.data === true, isLoading: query.isLoading };
}
