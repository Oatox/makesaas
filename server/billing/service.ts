import type { SupabaseClient } from "@supabase/supabase-js";
import type { Whop } from "@whop/sdk";
import { PLAN, grantsAccess, type CheckoutSession, type PaywallPlan } from "@shared/billing";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import type { WhopConfig } from "./config";

/** Metadata key carrying the Supabase user id from the checkout to the membership. */
export const USER_ID_METADATA_KEY = "supabase_user_id";

const PRICE_TTL_MS = 10 * 60 * 1000;

type SubscriptionRow = { status: string; whop_membership_id: string | null };

/** Whop subscriptions: checkout sessions for the paywall, and membership → subscriptions row sync. */
export class BillingService {
  private cachedPlan: { value: PaywallPlan; expiresAt: number } | null = null;

  constructor(
    private readonly whop: WhopConfig,
    private readonly db: SupabaseClient,
  ) {}

  get environment() {
    return this.whop.environment;
  }

  /** The plan with its Whop price, cached a few minutes (prices change rarely). */
  async getPaywallPlan(): Promise<PaywallPlan> {
    if (this.cachedPlan && this.cachedPlan.expiresAt > Date.now()) return this.cachedPlan.value;

    const base = { name: PLAN.name, description: PLAN.description };
    try {
      const variant = await this.whop.client.variants.retrieve({ id: this.whop.planId });
      const value = { ...base, price: variant.renewal_price || variant.initial_price, currency: variant.currency };
      this.cachedPlan = { value, expiresAt: Date.now() + PRICE_TTL_MS };
      return value;
    } catch (err) {
      // The paywall still works without the price: the checkout shows it.
      logger.error({ err }, "Failed to load Whop plan price");
      return { ...base, price: null, currency: null };
    }
  }

  /** A checkout configuration bound to the user: its metadata comes back on the membership. */
  async createCheckout(userId: string, redirectUrl?: string): Promise<CheckoutSession> {
    const current = await this.getSubscription(userId);
    if (grantsAccess(current?.status)) {
      throw new HttpError(409, "Vous êtes déjà abonné.");
    }

    try {
      const config = await this.whop.client.checkoutConfigurations.create({
        variant_id: this.whop.planId,
        // Without it Whop sends the buyer to the Whop store page once paid, not back to the app.
        ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
        metadata: { [USER_ID_METADATA_KEY]: userId },
      });
      return { sessionId: config.id };
    } catch (err) {
      logger.error({ err, userId }, "Failed to create Whop checkout configuration");
      throw new HttpError(502, "Le paiement est momentanément indisponible, réessayez dans un instant.");
    }
  }

  /**
   * Applies a membership to the user's subscription row. The membership is re-read from Whop rather than trusted
   * from the webhook payload, so late or replayed events always apply the current state.
   */
  async syncMembership(membershipId: string): Promise<void> {
    const membership = await this.whop.client.memberships.retrieve({ id: membershipId });
    if (membership.variant_id !== this.whop.planId) {
      logger.warn({ membershipId, variantId: membership.variant_id }, "Whop membership on a plan the app does not sell");
      return;
    }

    const userId = await this.resolveUserId(membership);
    if (!userId) {
      logger.warn({ membershipId }, "Whop membership without a matching app user");
      return;
    }
    if (!(await this.userExists(userId))) {
      logger.warn({ membershipId, userId }, "Whop membership for a deleted app user");
      return;
    }

    const current = await this.getSubscription(userId);
    const isCurrent = current?.whop_membership_id === membership.id;

    if (!isCurrent) {
      // Another membership than the row's (a new subscription): it takes the row over only if it grants
      // access, and never from a Whop membership still running, so an old one ending cannot cut access.
      if (!grantsAccess(membership.status)) return;
      if (await this.isHeldByRunningMembership(current)) {
        logger.error(
          { userId, membershipId, currentMembershipId: current?.whop_membership_id },
          "Duplicate Whop membership: the user pays twice, refund and cancel one from the Whop dashboard",
        );
        return;
      }
    }

    await this.saveMembership(userId, membership);

    if (!isCurrent) {
      logger.info({ userId, membershipId }, "Subscription activated");
    } else if (grantsAccess(current.status) && !grantsAccess(membership.status)) {
      logger.info({ userId, membershipId, status: membership.status }, "Subscription ended");
    }
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
   * Whether the row belongs to a Whop membership that still grants access. Checked on Whop itself: the row
   * may be stale if one of that membership's events was missed.
   */
  private async isHeldByRunningMembership(current: SubscriptionRow | null): Promise<boolean> {
    if (!current?.whop_membership_id || !grantsAccess(current.status)) return false;
    const held = await this.whop.client.memberships.retrieve({ id: current.whop_membership_id });
    return grantsAccess(held.status);
  }

  private async userExists(userId: string): Promise<boolean> {
    const { data, error } = await this.db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (error) throw error;
    return !!data;
  }

  private async getSubscription(userId: string): Promise<SubscriptionRow | null> {
    const { data, error } = await this.db
      .from("subscriptions")
      .select("status, whop_membership_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as SubscriptionRow | null;
  }

  /** Points the user's single subscription row to the membership, with its current state. */
  private async saveMembership(userId: string, membership: Whop.Membership): Promise<void> {
    const { error } = await this.db.from("subscriptions").upsert(
      {
        user_id: userId,
        status: membership.status,
        provider: "whop",
        current_period_end: membership.current_period_end,
        cancel_at_period_end: membership.cancel_at_period_end,
        whop_membership_id: membership.id,
        whop_user_id: membership.user_id,
        manage_url: membership.manage_url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  }
}
