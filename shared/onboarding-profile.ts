import { z } from "zod";

/**
 * The member's answers to the onboarding (/onboarding), as question → answer lines in their own
 * words. The onboarding happens before the account exists, so the answers live in localStorage
 * (client/src/lib/onboarding-storage.ts) until the client sends them as lines, built from the
 * steps' labels (client/src/components/onboarding/profile.ts). The server keeps them in
 * profiles.onboarding_profile, and the AI pipelines read them (the SaaS ideas, shared/ideas.ts).
 */

export const ONBOARDING_PROFILE_MAX_LINES = 40;
export const ONBOARDING_QUESTION_MAX_LENGTH = 200;
export const ONBOARDING_ANSWER_MAX_LENGTH = 400;

export const onboardingProfileSchema = z
  .array(
    z.object({
      question: z.string().trim().min(1).max(ONBOARDING_QUESTION_MAX_LENGTH),
      answer: z.string().trim().min(1).max(ONBOARDING_ANSWER_MAX_LENGTH),
    }),
  )
  .max(ONBOARDING_PROFILE_MAX_LINES);
export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;

/** The profile as lines of a prompt. */
export function formatOnboardingProfile(profile: OnboardingProfile | null | undefined): string {
  if (!profile?.length) return "Le membre n'a pas répondu au questionnaire.";
  return profile.map(({ question, answer }) => `- ${question} → ${answer}`).join("\n");
}
