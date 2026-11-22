import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { logger } from "../lib/logger";

export type WhopEnvironmentName = "production" | "sandbox";

export type WhopConfig = {
  client: WhopClient;
  environment: WhopEnvironmentName;
  webhookSecret: string | undefined;
  /** Whop plan (variant) id of the app's single plan. */
  planId: string;
};

/**
 * Whop settings, all server-only:
 * - WHOP_API_KEY: account API key (Dashboard → Developer → API keys)
 * - WHOP_WEBHOOK_SECRET: signing secret of the webhook (ws_...)
 * - WHOP_PLAN_ID: plan_... id of the monthly plan
 * - WHOP_ENVIRONMENT: "sandbox" to use sandbox.whop.com, production otherwise
 * Null (billing disabled) when the key or the plan id is missing.
 */
export function loadWhopConfig(): WhopConfig | null {
  const apiKey = process.env.WHOP_API_KEY;
  const planId = process.env.WHOP_PLAN_ID;

  if (!apiKey || !planId) {
    logger.warn(
      { hasApiKey: Boolean(apiKey), hasPlanId: Boolean(planId) },
      "Billing is disabled: WHOP_API_KEY or WHOP_PLAN_ID missing",
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
    planId,
  };
}
