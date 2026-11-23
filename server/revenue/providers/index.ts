import type { RevenueProvider } from "@shared/revenue";
import { StripeSource } from "./stripe";
import type { RevenueSource } from "./types";
import { WhopSource } from "./whop";

export { ProviderError, type ProviderAccount, type RevenueSource } from "./types";

/**
 * The source reading one provider with the member's key. `livemode` is known once connected (it
 * picks the Whop environment); unknown on a new connection.
 */
export function createRevenueSource(provider: RevenueProvider, apiKey: string, livemode?: boolean): RevenueSource {
  switch (provider) {
    case "stripe":
      return new StripeSource(apiKey);
    case "whop":
      return new WhopSource(apiKey, livemode === undefined ? null : livemode ? "production" : "sandbox");
  }
}
