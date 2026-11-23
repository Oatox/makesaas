/**
 * A single paid plan unlocks the whole app. There is no free plan: a user without a subscription
 * granting access (or the admin role) has no access to the app.
 */

// ⚠️ PLACEHOLDER: name and describe your plan (also shown on the CGV page).
export const PLAN = {
  name: "MakeSaaS Pro",
  /** One line under the plan name in the settings. */
  description: "Accès complet à toutes les fonctionnalités",
} as const;

/**
 * The plan is sold for several billing periods (the same access), each a Whop plan of the product
 * WHOP_PRODUCT_ID, found by its period (`days`, a few days either way). The paywall offers the
 * periods the product has, in this order (WHOP_PLAN_ID instead: a single monthly plan).
 */
export const OFFER_KEYS = ["monthly", "quarterly", "annual"] as const;
export type OfferKey = (typeof OFFER_KEYS)[number];

export type OfferDetails = {
  /** Name on the paywall card. */
  name: string;
  /** After the price ("29,99 € / 3 mois"). */
  period: string;
  /** Length of a billing period, for the struck-through price and the daily price. */
  months: number;
  days: number;
};

// ⚠️ PLACEHOLDER: the periods you sell (each needs its Whop plan) and the one recommended.
export const OFFERS: Record<OfferKey, OfferDetails> = {
  monthly: { name: "1 mois", period: "/ mois", months: 1, days: 30 },
  quarterly: { name: "3 mois", period: "/ 3 mois", months: 3, days: 90 },
  annual: { name: "12 mois", period: "/ an", months: 12, days: 365 },
};

/** Selected when the paywall opens, and flagged "Recommandé" (falls back to the first offer sold). */
export const RECOMMENDED_OFFER: OfferKey = "quarterly";

export function isOfferKey(value: unknown): value is OfferKey {
  return typeof value === "string" && (OFFER_KEYS as readonly string[]).includes(value);
}

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
  /** Public: the offers shown on the paywall, with their prices read from Whop. */
  plan: { path: "/api/billing/plan" },
  /** Creates a Whop checkout session for the signed-in user, for one offer (body: CheckoutRequest). */
  checkout: { path: "/api/billing/checkout" },
  /** Stops the renewal of the signed-in user's Whop subscription (access stays until the period ends). */
  cancel: { path: "/api/billing/subscription/cancel" },
  /** Reverses a pending cancellation: the subscription renews again. */
  resume: { path: "/api/billing/subscription/resume" },
  /** Whop webhook (memberships, payments). Signed, raw body. */
  webhook: { path: "/api/billing/whop/webhook" },
} as const;

export type CheckoutRequest = { offer: OfferKey };

export type CheckoutSession = {
  /** Whop checkout configuration id, passed to the embedded checkout. */
  sessionId: string;
};

export type PaywallOffer = {
  key: OfferKey;
  /** Price of one billing period in the offer currency, null when Whop could not be reached. */
  price: number | null;
  currency: string | null;
};

export type PaywallResponse = {
  /** The offers on sale, in OFFER_KEYS order (monthly always first). */
  offers: PaywallOffer[];
  environment: "production" | "sandbox";
};
