import type { Express, Request } from "express";
import { unwrapWebhook, WebhookVerificationError } from "@whop/sdk/helpers";
import { billingApi, isOfferKey, type CheckoutSession, type PaywallResponse } from "@shared/billing";
import { getUserId, requireUser } from "../lib/auth";
import { asyncRoute, HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase-admin";
import { getIdeasService } from "../ideas/service";
import { loadWhopConfig } from "./config";
import { BillingService } from "./service";

const BILLING_UNAVAILABLE = "Les abonnements ne sont pas encore disponibles.";

/** Events that change a membership (current API names, plus the legacy ones of unpinned webhooks). */
const MEMBERSHIP_EVENTS = new Set([
  "membership.activated",
  "membership.updated",
  "membership.deactivated",
  "membership.went_valid",
  "membership.went_invalid",
  "membership.cancel_at_period_end_changed",
]);
/** Payment events carry the membership they renew (or fail to renew). */
const PAYMENT_EVENTS = new Set(["payment.succeeded", "payment.failed"]);

type WhopWebhookEvent = { type?: string; data?: Record<string, unknown> };

/** The membership an event is about, whatever the payload version. */
function membershipIdOf(event: WhopWebhookEvent): string | null {
  const data = event.data ?? {};
  const type = event.type ?? "";
  if (MEMBERSHIP_EVENTS.has(type)) return typeof data.id === "string" ? data.id : null;
  if (PAYMENT_EVENTS.has(type)) {
    if (typeof data.membership_id === "string") return data.membership_id;
    const membership = data.membership as { id?: unknown } | undefined;
    return typeof membership?.id === "string" ? membership.id : null;
  }
  return null;
}

/**
 * Where Whop sends the buyer back once paid: the paywall on the page's origin (the browser sets
 * Origin on this POST). Whop only accepts https URLs, so none on http (local dev): Whop then falls
 * back to its own store page.
 */
function checkoutRedirectUrl(req: Request): string | undefined {
  try {
    const url = new URL(req.get("origin") ?? "");
    if (url.protocol === "https:") return `${url.origin}/abonnement`;
  } catch {
    // Missing or malformed header.
  }
  return undefined;
}

export function registerBillingRoutes(app: Express) {
  const whop = loadWhopConfig();
  const billing = whop && supabaseAdmin ? new BillingService(whop, supabaseAdmin) : null;

  const requireBilling = () => {
    if (!billing) throw new HttpError(503, BILLING_UNAVAILABLE);
    return billing;
  };

  // Public: the offers can be shown before sign-up.
  app.get(
    billingApi.plan.path,
    asyncRoute(async (_req, res) => {
      const billing = requireBilling();
      const body: PaywallResponse = { offers: await billing.getPaywallOffers(), environment: billing.environment };
      res.set("Cache-Control", "public, max-age=300").json(body);
    }),
  );

  app.post(
    billingApi.checkout.path,
    requireUser,
    asyncRoute(async (req, res) => {
      // Body: CheckoutRequest. Without an offer (older clients), the monthly one.
      const offer: unknown = req.body?.offer ?? "monthly";
      if (!isOfferKey(offer)) throw new HttpError(400, "Offre inconnue.");
      const session: CheckoutSession = await requireBilling().createCheckout(getUserId(res), offer, checkoutRedirectUrl(req));
      res.status(201).json(session);
    }),
  );

  // The member stops or restarts the renewal from the settings (access stays until the period ends).
  for (const [path, cancel] of [
    [billingApi.cancel.path, true],
    [billingApi.resume.path, false],
  ] as const) {
    app.post(
      path,
      requireUser,
      asyncRoute(async (_req, res) => {
        await requireBilling().setCancelAtPeriodEnd(getUserId(res), cancel);
        res.status(204).end();
      }),
    );
  }

  // Signed by Whop (Standard Webhooks). Verified on the exact bytes received (req.rawBody, kept by
  // express.json in server/index.ts). A 5xx makes Whop retry, so only processing errors return one.
  app.post(billingApi.webhook.path, async (req: Request, res) => {
    if (!billing || !whop?.webhookSecret) return res.status(503).json({ message: BILLING_UNAVAILABLE });

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) return res.status(400).json({ message: "Corps de requête manquant." });

    let event: WhopWebhookEvent;
    try {
      event = unwrapWebhook<WhopWebhookEvent>(rawBody.toString("utf8"), {
        headers: req.headers as Record<string, string>,
        key: whop.webhookSecret,
      });
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        logger.warn({ err: err.message }, "Rejected Whop webhook with an invalid signature");
        return res.status(401).json({ message: "Signature invalide." });
      }
      throw err;
    }

    const membershipId = membershipIdOf(event);
    if (!membershipId) {
      // Subscribed to more events than needed, or a shape we do not know: acknowledge, nothing to do.
      logger.info({ type: event.type }, "Ignored Whop webhook");
      return res.status(200).json({ received: true });
    }

    try {
      const activatedUserId = await billing.syncMembership(membershipId);
      // A new member: Gus starts writing their first SaaS ideas now, in the background, so that they
      // are ready (or nearly) when the member lands on /lancement.
      if (activatedUserId) void getIdeasService()?.startWelcomeIdeas(activatedUserId);
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err, type: event.type, membershipId }, "Failed to process Whop webhook");
      res.status(500).json({ message: "Traitement impossible, Whop réessaiera." });
    }
  });
}
