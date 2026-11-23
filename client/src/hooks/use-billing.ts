import { useMutation, useQuery } from "@tanstack/react-query";
import { billingApi, type CheckoutRequest, type CheckoutSession, type OfferKey, type PaywallResponse } from "@shared/billing";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, ApiError } from "@/lib/api-client";

export const billingKeys = {
  offers: ["billing", "offers"] as const,
};

/** The offers and their prices shown on the paywall (public route: works before sign-up). */
export function usePaywallOffers() {
  return useQuery<PaywallResponse>({
    queryKey: billingKeys.offers,
    queryFn: async () => {
      const response = await fetch(billingApi.plan.path);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(response.status, payload?.message ?? "Offre indisponible, réessaie.");
      return payload as PaywallResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Stops (`true`) or restarts (`false`) the renewal of the signed-in user's subscription, then
 * reloads the profile (it carries the subscription row the server just synced).
 */
export function useSetCancelAtPeriodEnd() {
  const { retryProfile } = useAuth();
  return useMutation({
    mutationFn: (cancel: boolean) => apiRequest<void>(cancel ? billingApi.cancel.path : billingApi.resume.path, { method: "POST" }),
    onSuccess: () => retryProfile(),
  });
}

/** A Whop checkout session for the signed-in user, on one offer. */
export function createCheckout(offer: OfferKey, signal?: AbortSignal) {
  const body: CheckoutRequest = { offer };
  return apiRequest<CheckoutSession>(billingApi.checkout.path, { method: "POST", body, signal });
}
