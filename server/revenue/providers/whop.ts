import { WhopClient, WhopEnvironment, WhopError, WhopTimeoutError, type Whop } from "@whop/sdk";
import { earliest, type NormalizedPayment, type NormalizedSubscription, type RevenueData } from "../metrics";
import { monthsForDays, ProviderError, type ProviderAccount, type RevenueSource } from "./types";

export type WhopEnvironmentName = "production" | "sandbox";

const PAGE_SIZE = 100;
const MAX_MEMBERSHIPS = 5_000;
const MAX_PAYMENTS = 10_000;
const MAX_VARIANTS = 1_000;

/** Statuses of a membership that pays now (canceling: cancelled at period end, paid until then). */
const PAYING = new Set<string>(["active", "past_due", "canceling"]);
const ENDED = new Set<string>(["canceled", "expired"]);

type VariantPrice = { renewalPrice: number; billingPeriod: number | null; currency: string };

function toProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof WhopTimeoutError) return new ProviderError("unavailable", "Whop ne répond pas, réessaie dans un instant.");
  if (err instanceof WhopError) {
    if (err.statusCode === 401) {
      return new ProviderError("invalid_key", "Whop refuse cette clé : vérifie qu'elle est complète et toujours active.");
    }
    if (err.statusCode === 403) {
      // Whop names the missing scope: "Company API key is not authorized for the payment:basic:read scope."
      const scope = /for the ([\w:]+) scope/.exec(JSON.stringify(err.body ?? ""))?.[1];
      return new ProviderError(
        "forbidden",
        scope
          ? `Cette clé n'a pas la permission ${scope} : ajoute-la à la clé dans Whop, puis réessaie.`
          : "Cette clé n'a pas les permissions de lecture nécessaires (paiements, membres, plans) : ajoute-les dans Whop.",
      );
    }
    if (err.statusCode === 429) {
      return new ProviderError("unavailable", "Whop limite les requêtes pour le moment, réessaie dans une minute.");
    }
  }
  return new ProviderError("unavailable", "Whop est momentanément indisponible, réessaie dans un instant.");
}

/** Up to `max` items of a paginated list. */
async function collect<T>(pages: AsyncIterable<T>, max: number) {
  const items: T[] = [];
  for await (const item of pages) {
    if (items.length >= max) return { items, truncated: true };
    items.push(item);
  }
  return { items, truncated: false };
}

export function normalizeWhopMembership(
  membership: Whop.Membership,
  variants: Map<string, VariantPrice>,
  now: number,
): NormalizedSubscription | null {
  const { status } = membership;
  const trialing = status === "trialing";
  if (!trialing && !PAYING.has(status) && !ENDED.has(status)) return null;

  // An ended membership no longer renews (no renewal price or period): its plan's are used instead.
  const variant = variants.get(membership.variant_id);
  const price = membership.renewal_price ? Number(membership.renewal_price.amount) : (variant?.renewalPrice ?? 0);
  const currency = (membership.renewal_price?.currency ?? variant?.currency ?? "usd").toUpperCase();
  const days = membership.billing_period_days ?? variant?.billingPeriod ?? null;

  const endedAt = ENDED.has(status)
    ? Math.min(now, Date.parse(membership.current_period_end ?? membership.expires_at ?? membership.canceled_at ?? membership.updated_at))
    : null;

  return {
    currency,
    monthlyAmount: days && price > 0 ? price / monthsForDays(days) : 0,
    paidFrom: trialing ? null : Date.parse(membership.created_at),
    endedAt: Number.isNaN(endedAt) ? now : endedAt,
    trialing,
  };
}

export function normalizeWhopPayment(payment: Whop.Payment): NormalizedPayment | null {
  if (payment.status !== "paid" || !payment.total) return null;
  const kind =
    payment.billing_reason === "subscription_create"
      ? "new_subscription"
      : payment.billing_reason === "subscription_cycle" || payment.billing_reason === "subscription_update"
        ? "renewal"
        : payment.billing_reason === "subscription"
          ? "subscription"
          : payment.billing_reason === "one_time" || payment.billing_reason === "manual"
            ? "one_time"
            : null;
  return {
    date: Date.parse(payment.paid_at ?? payment.created_at),
    amount: Number(payment.total.amount) - Number(payment.refunded_amount?.amount ?? 0),
    currency: payment.currency.toUpperCase(),
    kind,
  };
}

/**
 * Whop, read with an account API key (Dashboard → Developer) allowed to read payments, members and
 * plans. Without a known environment, the key is tried on production, then on the sandbox.
 */
export class WhopSource implements RevenueSource {
  constructor(
    private readonly apiKey: string,
    private environment: WhopEnvironmentName | null,
  ) {}

  private client(environment: WhopEnvironmentName) {
    return new WhopClient({
      token: this.apiKey,
      environment: environment === "sandbox" ? WhopEnvironment.Sandbox : WhopEnvironment.Production,
      timeoutInSeconds: 20,
    });
  }

  async account(): Promise<ProviderAccount> {
    const environments: WhopEnvironmentName[] = this.environment ? [this.environment] : ["production", "sandbox"];
    let lastError: ProviderError | null = null;
    for (const environment of environments) {
      try {
        const account = await this.client(environment).accounts.me();
        this.environment = environment;
        return {
          accountId: account.id,
          accountName: account.title || account.business_name || null,
          livemode: environment === "production",
        };
      } catch (err) {
        lastError = toProviderError(err);
        // Known key without the permission to read its account: the data names it (see fetch).
        if (lastError.kind === "forbidden") {
          this.environment = environment;
          return { accountId: null, accountName: null, livemode: environment === "production" };
        }
        if (lastError.kind !== "invalid_key") throw lastError;
      }
    }
    throw lastError!;
  }

  async fetch(since: number, now: number): Promise<RevenueData> {
    const client = this.client(this.environment ?? "production");
    try {
      // Memberships first: they name the account, which the plans list requires.
      const memberships = await client.memberships.list({ first: PAGE_SIZE }).then((pages) => collect(pages, MAX_MEMBERSHIPS));
      const seller = memberships.items[0]?.account;
      const accountFilter = seller ? { account_id: seller.id } : {};

      const [payments, variants] = await Promise.all([
        client.payments
          .list({ first: PAGE_SIZE, statuses: ["paid"], created_after: new Date(since).toISOString(), ...accountFilter })
          .then((pages) => collect(pages, MAX_PAYMENTS)),
        seller
          ? client.variants.list({ first: PAGE_SIZE, account_id: seller.id }).then((pages) => collect(pages, MAX_VARIANTS))
          : { items: [], truncated: false },
      ]);

      const variantPrices = new Map<string, VariantPrice>(
        variants.items.map((variant) => [
          variant.id,
          { renewalPrice: variant.renewal_price, billingPeriod: variant.billing_period, currency: variant.currency },
        ]),
      );

      return {
        subscriptions: memberships.items.flatMap((membership) => normalizeWhopMembership(membership, variantPrices, now) ?? []),
        payments: payments.items.flatMap((payment) => normalizeWhopPayment(payment) ?? []),
        truncated: memberships.truncated || payments.truncated,
        account: seller ? { id: seller.id, name: seller.title || null } : undefined,
        // A drafted membership is a checkout left before the end; any other one went through.
        firstCheckoutAt: earliest([
          ...memberships.items.filter((membership) => membership.status !== "drafted").map((membership) => Date.parse(membership.created_at)),
          ...payments.items.map((payment) => Date.parse(payment.paid_at ?? payment.created_at)),
        ]),
      };
    } catch (err) {
      throw toProviderError(err);
    }
  }
}
