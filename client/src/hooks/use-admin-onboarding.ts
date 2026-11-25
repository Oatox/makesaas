import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminApi, type AdminOnboardingStats, type OnboardingStatsPeriod } from "@shared/admin";
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
