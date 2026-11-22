/**
 * A single paid plan unlocks the whole app. There is no free plan: a user without a subscription
 * granting access (or the admin role) has no access to the app.
 */

// ⚠️ PLACEHOLDER: name and describe your plan (also shown on the CGV page).
export const PLAN = {
  name: "MakeSaaS Pro",
  /** One line under the plan name on the paywall and in the settings. */
  description: "Accès complet : SaaS illimités et toutes les fonctionnalités",
} as const;

/**
 * Subscription statuses that grant access (Whop membership statuses: past_due is the grace period
 * while Whop retries the payment, canceling a subscription cancelled at period end, still running).
 * Mirrored by public.subscription_grants_access in supabase_setup.sql.
 */
export const ACCESS_STATUSES = ["active", "trialing", "past_due", "completed", "canceling"] as const;

export function grantsAccess(status: string | null | undefined): boolean {
  return !!status && (ACCESS_STATUSES as readonly string[]).includes(status);
}

/** Columns of public.subscriptions the client reads (its own row; admins any row). */
export type SubscriptionSummary = {
  status: string;
  provider: "whop" | "manual";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  whop_membership_id: string | null;
  manage_url: string | null;
};

export const SUBSCRIPTION_SUMMARY_COLUMNS =
  "status, provider, current_period_end, cancel_at_period_end, whop_membership_id, manage_url";

export const billingApi = {
  /** Public: the plan shown on the paywall, with its price read from Whop. */
  plan: { path: "/api/billing/plan" },
  /** Creates a Whop checkout session for the signed-in user. */
  checkout: { path: "/api/billing/checkout" },
  /** Whop webhook (memberships, payments). Signed, raw body. */
  webhook: { path: "/api/billing/whop/webhook" },
} as const;

export type CheckoutSession = {
  /** Whop checkout configuration id, passed to the embedded checkout. */
  sessionId: string;
};

export type PaywallPlan = {
  name: string;
  description: string;
  /** Monthly price in the plan currency, null when Whop could not be reached. */
  price: number | null;
  currency: string | null;
};

export type PaywallResponse = {
  plan: PaywallPlan;
  environment: "production" | "sandbox";
};
