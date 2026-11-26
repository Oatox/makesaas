import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi, type AdminOnboardingScreen, type AdminOnboardingStats, type OnboardingStatsPeriod } from "@shared/admin";
import { apiRequest } from "@/lib/api-client";

/** The onboarding's funnel and screens over the period, read from Amplitude by the server (kept 5 min there too). */
export function useAdminOnboarding(days: OnboardingStatsPeriod) {
  return useQuery({
    queryKey: ["admin-onboarding", days],
    queryFn: ({ signal }) => apiRequest<AdminOnboardingStats>(adminApi.onboarding, { query: { days }, signal }),
    staleTime: 5 * 60 * 1000,
    // The previous period stays on screen while the next one loads.
    placeholderData: keepPreviousData,
    // A missing key or a refusal from Amplitude does not fix itself: say it at once.
    retry: false,
  });
}

/** A screen opened from the list: its position (0: the landing page), whether it is the last one, the answers asked. */
export type OnboardingScreenRequest = { number: number; last: boolean; keys: string[] };

/** The time spent on a screen and the answers to its questions over the period, from Amplitude (kept 5 min). */
export function useAdminOnboardingScreen(days: OnboardingStatsPeriod, screen: OnboardingScreenRequest | null) {
  return useQuery({
    queryKey: ["admin-onboarding-screen", days, screen?.number, screen?.last, screen?.keys.join(",")],
    queryFn: ({ signal }) =>
      apiRequest<AdminOnboardingScreen>(adminApi.onboardingScreen, {
        query: { days, number: screen!.number, last: screen!.last ? 1 : 0, keys: screen!.keys.join(",") },
        signal,
      }),
    enabled: screen !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
