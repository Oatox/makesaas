import { useMutation, useQuery } from "@tanstack/react-query";
import { billingApi, type CheckoutSession, type PaywallResponse } from "@shared/billing";
import { apiRequest, ApiError } from "@/lib/api-client";

export const billingKeys = {
  plan: ["billing", "plan"] as const,
};

/** The plan and its price shown on the paywall (public route: works before sign-up). */
export function usePaywallPlan() {
  return useQuery<PaywallResponse>({
    queryKey: billingKeys.plan,
    queryFn: async () => {
      const response = await fetch(billingApi.plan.path);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(response.status, payload?.message ?? "Offre indisponible, réessayez.");
      return payload as PaywallResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** A Whop checkout session for the signed-in user. */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: () => apiRequest<CheckoutSession>(billingApi.checkout.path, { method: "POST" }),
  });
}
