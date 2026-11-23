import type { SupabaseClient } from "@supabase/supabase-js";
import type { Whop } from "@whop/sdk";
import { OFFER_KEYS, OFFERS, grantsAccess, type CheckoutSession, type OfferKey, type PaywallOffer } from "@shared/billing";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import type { WhopConfig } from "./config";

/** Metadata key carrying the Supabase user id from the checkout to the membership. */
export const USER_ID_METADATA_KEY = "supabase_user_id";

const PLANS_TTL_MS = 10 * 60 * 1000;

type SubscriptionRow = { status: string; whop_membership_id: string | null };

/** A Whop plan on sale: the offer it is, and its price (null when Whop could not be reached). */
type SoldPlan = { key: OfferKey; planId: string; price: number | null; currency: string | null };

/** The offer a renewal period stands for (30, 90 or 365 days, a few days either way), if any. */
function offerForPeriod(days: number | null): OfferKey | null {
  if (days === null) return null;
  return OFFER_KEYS.find((key) => Math.abs(OFFERS[key].days - days) <= 3) ?? null;
}

/** Whop subscriptions: checkout sessions for the paywall, and membership → subscriptions row sync. */
export class BillingService {
  private cachedPlans: { value: SoldPlan[]; expiresAt: number } | null = null;

  constructor(
    private readonly whop: WhopConfig,
    private readonly db: SupabaseClient,
  ) {}

  get environment() {
    return this.whop.environment;
  }

  /** The offers on sale with their Whop prices, in OFFER_KEYS order. */
  async getPaywallOffers(): Promise<PaywallOffer[]> {
    return (await this.soldPlans()).map(({ key, price, currency }) => ({ key, price, currency }));
  }

  /** The plans on sale, cached a few minutes (they change rarely); one without its price is retried next time. */
  private async soldPlans(): Promise<SoldPlan[]> {
    if (this.cachedPlans && this.cachedPlans.expiresAt > Date.now()) return this.cachedPlans.value;

    const { catalog } = this.whop;
    const value = catalog.kind === "product" ? await this.productPlans(catalog.productId) : [await this.singlePlan(catalog.planId)];
    if (value.every((plan) => plan.price !== null)) this.cachedPlans = { value, expiresAt: Date.now() + PLANS_TTL_MS };
    return value;
  }

  /** The product's visible renewal plans of 1, 3 and 12 months; the newest wins when two share a period. */
  private async productPlans(productId: string): Promise<SoldPlan[]> {
    const found = new Map<OfferKey, { plan: SoldPlan; createdAt: string }>();
    try {
      const page = await this.whop.client.variants.list({
        product_ids: [productId],
        billing_types: ["renewal"],
        visibilities: ["visible"],
        release_methods: ["buy_now"],
      });
      for await (const variant of page) {
        const key = offerForPeriod(variant.billing_period);
        if (!key) continue;
        const previous = found.get(key);
        if (previous) {
          logger.warn({ productId, offer: key, plans: [previous.plan.planId, variant.id] }, "Two Whop plans share a billing period: the newest is sold");
        }
        if (!previous || variant.created_at > previous.createdAt) {
          const plan = { key, planId: variant.id, price: variant.renewal_price || variant.initial_price, currency: variant.currency };
          found.set(key, { plan, createdAt: variant.created_at });
        }
      }
    } catch (err) {
      logger.error({ err, productId }, "Failed to list the Whop product's plans");
      throw new HttpError(502, "Les offres sont momentanément indisponibles, réessayez dans un instant.");
    }

    if (found.size === 0) {
      logger.error({ productId }, "The Whop product has no visible renewal plan of 30, 90 or 365 days");
      throw new HttpError(503, "Les abonnements ne sont pas encore disponibles.");
    }
    return OFFER_KEYS.flatMap((key) => {
      const entry = found.get(key);
      return entry ? [entry.plan] : [];
    });
  }

  /** A single monthly plan (WHOP_PLAN_ID). */
  private async singlePlan(planId: string): Promise<SoldPlan> {
    try {
      const variant = await this.whop.client.variants.retrieve({ id: planId });
      return { key: "monthly", planId, price: variant.renewal_price || variant.initial_price, currency: variant.currency };
    } catch (err) {
      // The paywall still works without the price: the checkout shows it.
      logger.error({ err, planId }, "Failed to load Whop plan price");
      return { key: "monthly", planId, price: null, currency: null };
    }
  }

  /** Whether a membership is on what the app sells: any plan of its product (older prices included), or its plan. */
  private sells(membership: Whop.Membership) {
    const { catalog } = this.whop;
    return catalog.kind === "product" ? membership.product_id === catalog.productId : membership.variant_id === catalog.planId;
  }

  /** A checkout configuration for one offer, bound to the user: its metadata comes back on the membership. */
  async createCheckout(userId: string, offer: OfferKey, redirectUrl?: string): Promise<CheckoutSession> {
    const plan = (await this.soldPlans()).find((p) => p.key === offer);
    if (!plan) throw new HttpError(400, "Cette offre n'est pas disponible.");

    const current = await this.getSubscription(userId);
    if (grantsAccess(current?.status)) {
      throw new HttpError(409, "Vous êtes déjà abonné.");
    }

    try {
      const config = await this.whop.client.checkoutConfigurations.create({
        variant_id: plan.planId,
        // Without it Whop sends the buyer to the Whop store page once paid, not back to the app.
        ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
        metadata: { [USER_ID_METADATA_KEY]: userId },
      });
      return { sessionId: config.id };
    } catch (err) {
      logger.error({ err, userId, offer }, "Failed to create Whop checkout configuration");
      throw new HttpError(502, "Le paiement est momentanément indisponible, réessayez dans un instant.");
    }
  }

  /**
   * Stops (`true`) or restarts (`false`) the renewal of the user's Whop subscription; access stays
   * until the paid period ends either way. The row is synced right away (the webhook that follows
   * finds it up to date).
   */
  async setCancelAtPeriodEnd(userId: string, cancel: boolean): Promise<void> {
    const current = await this.getSubscription(userId);
    if (!current?.whop_membership_id || !grantsAccess(current.status)) {
      throw new HttpError(404, "Aucun abonnement en cours à gérer.");
    }

    try {
      await this.whop.client.memberships.update({ id: current.whop_membership_id, cancel_at_period_end: cancel });
    } catch (err) {
      logger.error({ err, userId, membershipId: current.whop_membership_id, cancel }, "Failed to change the Whop subscription renewal");
      throw new HttpError(502, "Impossible de modifier l'abonnement pour le moment, réessayez dans un instant.");
    }
    await this.syncMembership(current.whop_membership_id);
    logger.info({ userId, membershipId: current.whop_membership_id }, cancel ? "Subscription set to end" : "Subscription renewal resumed");
  }

  /**
   * Applies a membership to the user's subscription row. The membership is re-read from Whop rather than trusted
   * from the webhook payload, so late or replayed events always apply the current state.
   */
  async syncMembership(membershipId: string): Promise<void> {
    const membership = await this.whop.client.memberships.retrieve({ id: membershipId });
    if (!this.sells(membership)) {
      logger.warn({ membershipId, variantId: membership.variant_id, productId: membership.product_id }, "Whop membership on a plan the app does not sell");
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
