import { WhopClient, WhopEnvironment } from "@whop/sdk";
import type { PlanId } from "@shared/billing";
import { logger } from "../lib/logger";

export type WhopEnvironmentName = "production" | "sandbox";

export type WhopConfig = {
  client: WhopClient;
  environment: WhopEnvironmentName;
  webhookSecret: string | undefined;
  /** Whop plan (variant) id behind each app plan. */
  planIds: Record<PlanId, string>;
};

/**
 * Whop settings, all server-only:
 * - WHOP_API_KEY: account API key (Dashboard → Developer → API keys)
 * - WHOP_WEBHOOK_SECRET: signing secret of the webhook (ws_...)
 * - WHOP_STARTER_PLAN_ID / WHOP_PRO_PLAN_ID: plan_... ids of the two monthly plans
 * - WHOP_ENVIRONMENT: "sandbox" to use sandbox.whop.com, production otherwise
 * Null (billing disabled) when the key or a plan id is missing.
 */
export function loadWhopConfig(): WhopConfig | null {
  const apiKey = process.env.WHOP_API_KEY;
  const starter = process.env.WHOP_STARTER_PLAN_ID;
  const pro = process.env.WHOP_PRO_PLAN_ID;

  if (!apiKey || !starter || !pro) {
    logger.warn(
      { hasApiKey: Boolean(apiKey), hasStarterPlan: Boolean(starter), hasProPlan: Boolean(pro) },
      "Billing is disabled: WHOP_API_KEY, WHOP_STARTER_PLAN_ID or WHOP_PRO_PLAN_ID missing",
    );
    return null;
  }

  const environment: WhopEnvironmentName = process.env.WHOP_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
  if (!webhookSecret) logger.warn("WHOP_WEBHOOK_SECRET missing: Whop webhooks will be rejected");

  return {
    client: new WhopClient({
      token: apiKey,
      environment: environment === "sandbox" ? WhopEnvironment.Sandbox : WhopEnvironment.Production,
    }),
    environment,
    webhookSecret,
    planIds: { starter, pro },
  };
}
