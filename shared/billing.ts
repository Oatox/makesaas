import { z } from "zod";

/** Paid plans. There is no free plan: a profile without a plan has no access to the app. */
export const PLAN_IDS = ["starter", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const planIdSchema = z.enum(PLAN_IDS);

export type PlanDefinition = {
  id: PlanId;
  name: string;
  /** One line under the plan name on the paywall and in the settings. */
  description: string;
};

// ⚠️ PLACEHOLDER: describe what each plan gives in your product.
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: { id: "starter", name: "Starter", description: "L'essentiel pour démarrer" },
  pro: { id: "pro", name: "Pro", description: "Toutes les fonctionnalités, sans limite" },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
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

/** The plan a subscription row gives right now, null when it gives no access. */
export function activePlan(subscription: { plan: string; status: string } | null | undefined): PlanId | null {
  if (!subscription || !grantsAccess(subscription.status) || !isPlanId(subscription.plan)) return null;
  return subscription.plan;
}

/** Columns of public.subscriptions the client reads (its own row; admins any row). */
export type SubscriptionSummary = {
  plan: PlanId;
  status: string;
  provider: "whop" | "manual";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  whop_membership_id: string | null;
  manage_url: string | null;
};

export const SUBSCRIPTION_SUMMARY_COLUMNS =
  "plan, status, provider, current_period_end, cancel_at_period_end, whop_membership_id, manage_url";

export const billingApi = {
  /** Public: the plans shown on the paywall, with prices read from Whop. */
  plans: { path: "/api/billing/plans" },
  /** Creates a Whop checkout session for the signed-in user and the chosen plan. */
  checkout: { path: "/api/billing/checkout" },
  /** Whop webhook (memberships, payments). Signed, raw body. */
  webhook: { path: "/api/billing/whop/webhook" },
} as const;

export const createCheckoutBodySchema = z.object({ plan: planIdSchema });
export type CreateCheckoutBody = z.infer<typeof createCheckoutBodySchema>;

export type CheckoutSession = {
  /** Whop checkout configuration id, passed to the embedded checkout. */
  sessionId: string;
  /** Whop plan id (plan_...) behind the session. */
  planId: string;
};

export type PaywallPlansResponse = {
  plans: PaywallPlan[];
  environment: "production" | "sandbox";
};

export type PaywallPlan = {
  id: PlanId;
  name: string;
  description: string;
  /** Monthly price in the plan currency, null when Whop could not be reached. */
  price: number | null;
  currency: string | null;
};
