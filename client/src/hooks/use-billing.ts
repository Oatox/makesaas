import { useMutation, useQuery } from "@tanstack/react-query";
import { billingApi, type CheckoutSession, type PaywallPlansResponse, type PlanId } from "@shared/billing";
import { apiRequest, ApiError } from "@/lib/api-client";

export const billingKeys = {
  plans: ["billing", "plans"] as const,
};

/** Plans and prices shown on the paywall (public route: works before sign-up). */
export function usePaywallPlans() {
  return useQuery<PaywallPlansResponse>({
    queryKey: billingKeys.plans,
    queryFn: async () => {
      const response = await fetch(billingApi.plans.path);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(response.status, payload?.message ?? "Offres indisponibles, réessayez.");
      return payload as PaywallPlansResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** A Whop checkout session for the signed-in user and the chosen plan. */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: (plan: PlanId) =>
      apiRequest<CheckoutSession>(billingApi.checkout.path, { method: "POST", body: { plan } }),
  });
}
