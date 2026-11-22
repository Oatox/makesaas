/**
 * Onboarding progress, kept on the device (localStorage): visitors answer the first questions
 * before having an account, so nothing can be stored in Supabase yet.
 * Bump STORAGE_VERSION when the shape changes in an incompatible way: old progress is dropped.
 */

const STORAGE_KEY = "makesaas:onboarding";
const STORAGE_VERSION = 1;

/** A single answer, or the picks of a multiple-choice step. */
export type OnboardingAnswers = Record<string, string | string[]>;

export type OnboardingProgress = {
  version: number;
  /** Index of the step currently shown. */
  stepIndex: number;
  /** Answers keyed by step id. */
  answers: OnboardingAnswers;
  updatedAt: string;
};

export function emptyOnboardingProgress(): OnboardingProgress {
  return { version: STORAGE_VERSION, stepIndex: 0, answers: {}, updatedAt: new Date().toISOString() };
}

export function loadOnboardingProgress(): OnboardingProgress {
  if (typeof window === "undefined") return emptyOnboardingProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOnboardingProgress();
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    if (parsed.version !== STORAGE_VERSION || typeof parsed.stepIndex !== "number" || typeof parsed.answers !== "object") {
      return emptyOnboardingProgress();
    }
    return {
      version: STORAGE_VERSION,
      stepIndex: Math.max(0, Math.floor(parsed.stepIndex)),
      answers: parsed.answers ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyOnboardingProgress();
  }
}

export function saveOnboardingProgress(progress: OnboardingProgress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }));
  } catch {
    // Private mode / quota: the onboarding still works, it just won't survive a reload.
  }
}

export function clearOnboardingProgress() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
