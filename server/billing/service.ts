import type { SupabaseClient } from "@supabase/supabase-js";
import type { Whop } from "@whop/sdk";
import { PLANS, PLAN_IDS, activePlan, grantsAccess, type CheckoutSession, type PaywallPlan, type PlanId } from "@shared/billing";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import type { WhopConfig } from "./config";
import { upgradeCreditDays } from "./upgrade-credit";

/** Metadata key carrying the Supabase user id from the checkout to the membership. */
export const USER_ID_METADATA_KEY = "supabase_user_id";

const PRICES_TTL_MS = 10 * 60 * 1000;

/** Statuses of a replaced membership whose current period was paid (a trial or an unpaid one gives no credit). */
const PAID_STATUSES = new Set(["active", "canceling"]);

type SubscriptionRow = { plan: PlanId; status: string; whop_membership_id: string | null };

/** Whop subscriptions: checkout sessions for the paywall, and membership → subscriptions row sync. */
export class BillingService {
  private prices: { value: PaywallPlan[]; expiresAt: number } | null = null;

  constructor(
    private readonly whop: WhopConfig,
    private readonly db: SupabaseClient,
  ) {}

  get environment() {
    return this.whop.environment;
  }

  /** The two plans with their Whop price, cached a few minutes (prices change rarely). */
  async getPaywallPlans(): Promise<PaywallPlan[]> {
    if (this.prices && this.prices.expiresAt > Date.now()) return this.prices.value;

    const value = await Promise.all(
      PLAN_IDS.map(async (id): Promise<PaywallPlan> => {
        const base = { id, name: PLANS[id].name, description: PLANS[id].description };
        try {
          const variant = await this.whop.client.variants.retrieve({ id: this.whop.planIds[id] });
          return { ...base, price: variant.renewal_price || variant.initial_price, currency: variant.currency };
        } catch (err) {
          // The paywall still works without the price: the checkout shows it.
          logger.error({ err, plan: id }, "Failed to load Whop plan price");
          return { ...base, price: null, currency: null };
        }
      }),
    );

    if (value.every((plan) => plan.price !== null)) {
      this.prices = { value, expiresAt: Date.now() + PRICES_TTL_MS };
    }
    return value;
  }

  /** A checkout configuration bound to the user: its metadata comes back on the membership. */
  async createCheckout(userId: string, plan: PlanId, redirectUrl?: string): Promise<CheckoutSession> {
    const current = activePlan(await this.getSubscription(userId));
    if (current === plan) {
      throw new HttpError(409, `Vous êtes déjà abonné au plan ${PLANS[plan].name}.`);
    }
    if (current === "pro" && plan === "starter") {
      throw new HttpError(409, "Pour passer au plan Starter, résiliez d'abord votre abonnement Pro depuis les paramètres.");
    }

    const planId = this.whop.planIds[plan];
    try {
      const config = await this.whop.client.checkoutConfigurations.create({
        variant_id: planId,
        // Without it Whop sends the buyer to the Whop store page once paid, not back to the app.
        ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
        metadata: { [USER_ID_METADATA_KEY]: userId, app_plan: plan },
      });
      return { sessionId: config.id, planId };
    } catch (err) {
      logger.error({ err, userId, plan }, "Failed to create Whop checkout configuration");
      throw new HttpError(502, "Le paiement est momentanément indisponible, réessayez dans un instant.");
    }
  }

  /**
   * Applies a membership to the user's subscription row. The membership is re-read from Whop rather than trusted
   * from the webhook payload, so late or replayed events always apply the current state.
   */
  async syncMembership(membershipId: string): Promise<void> {
    const membership = await this.whop.client.memberships.retrieve({ id: membershipId });
    const plan = this.planOf(membership.variant_id);
    const userId = await this.resolveUserId(membership);

    if (!userId) {
      logger.warn({ membershipId, variantId: membership.variant_id }, "Whop membership without a matching app user");
      return;
    }
    if (!plan) {
      logger.warn({ membershipId, variantId: membership.variant_id }, "Whop membership on a plan the app does not sell");
      return;
    }

    if (!(await this.userExists(userId))) {
      logger.warn({ membershipId, userId }, "Whop membership for a deleted app user");
      return;
    }

    const current = await this.getSubscription(userId);
    const isCurrent = current?.whop_membership_id === membership.id;

    if (!grantsAccess(membership.status)) {
      // An old membership ending (e.g. the Starter one after an upgrade) must not touch the new one.
      if (!isCurrent) return;
      await this.saveSubscription(userId, {
        status: membership.status,
        current_period_end: membership.current_period_end,
        cancel_at_period_end: membership.cancel_at_period_end,
        manage_url: membership.manage_url,
      });
      logger.info({ userId, membershipId, status: membership.status }, "Subscription ended");
      return;
    }

    const fields = {
      plan,
      status: membership.status,
      provider: "whop",
      current_period_end: membership.current_period_end,
      cancel_at_period_end: membership.cancel_at_period_end,
      whop_membership_id: membership.id,
      whop_user_id: membership.user_id,
      manage_url: membership.manage_url,
    };

    // Upgrade Starter → Pro: the Pro checkout created a second membership. Several events of the new
    // membership can arrive at once: only the one that switches the row replaces the old membership,
    // so the Starter plan is cancelled and its unused days credited exactly once.
    const previousMembershipId = isCurrent ? null : current?.whop_membership_id;
    if (previousMembershipId && (await this.switchSubscription(userId, previousMembershipId, fields))) {
      logger.info({ userId, membershipId, plan, previousMembershipId }, "Subscription upgraded");
      await this.replaceMembership(previousMembershipId, membership, userId);
      return;
    }

    await this.saveSubscription(userId, fields);
    if (!isCurrent) logger.info({ userId, membershipId, plan }, "Subscription activated");
  }

  private planOf(variantId: string): PlanId | null {
    return PLAN_IDS.find((id) => this.whop.planIds[id] === variantId) ?? null;
  }

  /** The user who paid: from the checkout metadata, or the subscription already linked to the membership. */
  private async resolveUserId(membership: Whop.Membership): Promise<string | null> {
    const fromMetadata = membership.metadata?.[USER_ID_METADATA_KEY];
    if (typeof fromMetadata === "string" && fromMetadata) return fromMetadata;

    const { data, error } = await this.db
      .from("subscriptions")
      .select("user_id")
      .eq("whop_membership_id", membership.id)
      .maybeSingle();
    if (error) throw error;
    return (data?.user_id as string | undefined) ?? null;
  }

  /**
   * Stops the replaced (Starter) membership now, and credits its paid but unused days on the new one as
   * free days (no proration in Whop: the Pro plan was paid in full).
   */
  private async replaceMembership(oldMembershipId: string, newMembership: Whop.Membership, userId: string): Promise<void> {
    let old: Whop.Membership;
    try {
      old = await this.whop.client.memberships.retrieve({ id: oldMembershipId });
      if (!grantsAccess(old.status)) return;
      // Immediate cancellation: the user now has Pro, the Starter plan must stop now.
      await this.whop.client.memberships.cancel({ id: oldMembershipId });
      logger.info({ userId, membershipId: oldMembershipId }, "Replaced membership cancelled");
    } catch (err) {
      // Not fatal for the user (they have their new plan), but they may be billed twice: alert.
      logger.error({ err, userId, membershipId: oldMembershipId }, "Failed to cancel the replaced Whop membership");
      return;
    }

    const sameCurrency = old.renewal_price?.currency === newMembership.renewal_price?.currency;
    const days =
      PAID_STATUSES.has(old.status) && sameCurrency
        ? upgradeCreditDays({
            now: new Date(),
            oldPeriodEnd: old.current_period_end,
            oldPrice: Number(old.renewal_price?.amount ?? 0),
            oldPeriodDays: old.billing_period_days,
            newPrice: Number(newMembership.renewal_price?.amount ?? 0),
            newPeriodDays: newMembership.billing_period_days,
          })
        : 0;
    if (days === 0) return;

    try {
      // Pushes the next Pro charge back; the membership.updated webhook then syncs the new period end.
      await this.whop.client.memberships.extend({ id: newMembership.id, days });
      logger.info({ userId, membershipId: newMembership.id, days }, "Unused Starter days credited on Pro");
    } catch (err) {
      // The user lost their Starter days: to be credited by hand from the Whop dashboard.
      logger.error({ err, userId, membershipId: newMembership.id, days }, "Failed to credit the unused Starter days");
    }
  }

  private async userExists(userId: string): Promise<boolean> {
    const { data, error } = await this.db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (error) throw error;
    return !!data;
  }

  private async getSubscription(userId: string): Promise<SubscriptionRow | null> {
    const { data, error } = await this.db
      .from("subscriptions")
      .select("plan, status, whop_membership_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as SubscriptionRow | null;
  }

  /**
   * Points the user's row to a new membership, only if it still points to `previousMembershipId`
   * (compare-and-swap). True when this call made the switch.
   */
  private async switchSubscription(
    userId: string,
    previousMembershipId: string,
    fields: Record<string, unknown>,
  ): Promise<boolean> {
    const { data, error } = await this.db
      .from("subscriptions")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("whop_membership_id", previousMembershipId)
      .select("user_id");
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  /** Upserts the user's single subscription row (an ended one only updates its status). */
  private async saveSubscription(userId: string, fields: Record<string, unknown>): Promise<void> {
    const row = { user_id: userId, ...fields, updated_at: new Date().toISOString() };
    const { error } =
      "plan" in fields
        ? await this.db.from("subscriptions").upsert(row, { onConflict: "user_id" })
        : await this.db.from("subscriptions").update(row).eq("user_id", userId);
    if (error) throw error;
  }
}
