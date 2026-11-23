import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { logger } from "../lib/logger";

export type WhopEnvironmentName = "production" | "sandbox";

/**
 * What the app sells: a Whop product, whose plans are offered by billing period (1, 3 and 12
 * months, see OFFERS in shared/billing.ts), or a single monthly plan.
 */
export type WhopCatalog = { kind: "product"; productId: string } | { kind: "plan"; planId: string };

export type WhopConfig = {
  client: WhopClient;
  environment: WhopEnvironmentName;
  webhookSecret: string | undefined;
  catalog: WhopCatalog;
};

/**
 * Whop settings, all server-only:
 * - WHOP_API_KEY: account API key (Dashboard → Developer → API keys)
 * - WHOP_WEBHOOK_SECRET: signing secret of the webhook (ws_...)
 * - WHOP_PRODUCT_ID: prod_... id of the product; its visible renewal plans of 30, 90 and 365 days
 *   become the 1, 3 and 12-month offers (only the periods it has are offered)
 * - WHOP_PLAN_ID: plan_... id of a single monthly plan, instead of a product
 * - WHOP_ENVIRONMENT: "sandbox" to use sandbox.whop.com, production otherwise
 * Null (billing disabled) when the key or both the product and the plan are missing.
 */
export function loadWhopConfig(): WhopConfig | null {
  const apiKey = process.env.WHOP_API_KEY;
  const planEnv = process.env.WHOP_PLAN_ID?.trim();
  // A product id put in WHOP_PLAN_ID is read as one.
  const productId = process.env.WHOP_PRODUCT_ID?.trim() || (planEnv?.startsWith("prod_") ? planEnv : undefined);
  const catalog: WhopCatalog | null = productId
    ? { kind: "product", productId }
    : planEnv
      ? { kind: "plan", planId: planEnv }
      : null;

  if (!apiKey || !catalog) {
    logger.warn(
      { hasApiKey: Boolean(apiKey), hasProductOrPlan: Boolean(catalog) },
      "Billing is disabled: WHOP_API_KEY or WHOP_PRODUCT_ID (or WHOP_PLAN_ID) missing",
    );
    return null;
  }
  if (!process.env.WHOP_PRODUCT_ID && planEnv?.startsWith("prod_")) {
    logger.warn("WHOP_PLAN_ID holds a product id (prod_...): read as WHOP_PRODUCT_ID, rename the variable");
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
    catalog,
  };
}
