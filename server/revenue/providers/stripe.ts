import type { NormalizedPayment, NormalizedSubscription, RevenueData } from "../metrics";
import { ProviderError, type ProviderAccount, type RevenueSource } from "./types";

const STRIPE_API = "https://api.stripe.com/v1";
/** Pinned so the fields read below do not change with the account's default API version. */
const STRIPE_VERSION = "2024-06-20";
const PAGE_SIZE = 100;
const MAX_SUBSCRIPTION_PAGES = 30;
const MAX_CHARGE_PAGES = 60;
const REQUEST_TIMEOUT_MS = 20_000;

/** Currencies Stripe counts in whole units, or in thousandths (https://docs.stripe.com/currencies). */
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

const toMajor = (amount: number, currency: string) =>
  amount / (ZERO_DECIMAL.has(currency) ? 1 : THREE_DECIMAL.has(currency) ? 1000 : 100);

type StripeList<T> = { data: T[]; has_more: boolean };

type StripeAccount = {
  id: string;
  email: string | null;
  business_profile?: { name?: string | null } | null;
  settings?: { dashboard?: { display_name?: string | null } } | null;
};

type StripeRecurring = { interval: "day" | "week" | "month" | "year"; interval_count: number; usage_type: "licensed" | "metered" };

type StripeSubscription = {
  id: string;
  status: "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
  currency: string;
  start_date: number;
  trial_end: number | null;
  ended_at: number | null;
  items: {
    data: {
      quantity?: number;
      price: { unit_amount: number | null; unit_amount_decimal: string | null; recurring: StripeRecurring | null };
    }[];
  };
  discount: { coupon: { percent_off: number | null; amount_off: number | null; currency: string | null } } | null;
};

type StripeCharge = {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  created: number;
  paid: boolean;
  status: "succeeded" | "pending" | "failed";
  invoice: string | null;
};

const MONTHS_PER_INTERVAL: Record<StripeRecurring["interval"], number> = { day: 12 / 365, week: 12 / 52, month: 1, year: 12 };

/** Statuses that never paid (incomplete) or stopped paying without ending (unpaid, paused): left out of MRR. */
const NOT_PAYING = new Set<StripeSubscription["status"]>(["incomplete", "incomplete_expired", "unpaid", "paused"]);

/** Recurring revenue per month of a subscription: licensed items at their price, its coupon applied. */
function monthlyAmount(subscription: StripeSubscription): number {
  let total = 0;
  let periodMonths = 1;
  for (const { price, quantity } of subscription.items.data) {
    // Metered and tiered prices have no fixed amount: left out, as in Stripe's own MRR.
    if (!price.recurring || price.recurring.usage_type === "metered") continue;
    const unitAmount = price.unit_amount ?? (price.unit_amount_decimal ? Number(price.unit_amount_decimal) : null);
    if (unitAmount === null) continue;
    periodMonths = MONTHS_PER_INTERVAL[price.recurring.interval] * price.recurring.interval_count;
    total += (unitAmount * (quantity ?? 1)) / periodMonths;
  }

  const coupon = subscription.discount?.coupon;
  if (coupon?.percent_off) total *= 1 - coupon.percent_off / 100;
  else if (coupon?.amount_off && coupon.currency === subscription.currency) total -= coupon.amount_off / periodMonths;

  return toMajor(Math.max(0, total), subscription.currency);
}

export function normalizeStripeSubscription(subscription: StripeSubscription): NormalizedSubscription {
  const paying = !NOT_PAYING.has(subscription.status);
  return {
    currency: subscription.currency.toUpperCase(),
    monthlyAmount: monthlyAmount(subscription),
    paidFrom: paying ? Math.max(subscription.start_date, subscription.trial_end ?? 0) * 1000 : null,
    endedAt: subscription.ended_at ? subscription.ended_at * 1000 : null,
    trialing: subscription.status === "trialing",
  };
}

export function normalizeStripeCharge(charge: StripeCharge): NormalizedPayment | null {
  if (!charge.paid || charge.status !== "succeeded") return null;
  return {
    date: charge.created * 1000,
    amount: toMajor(charge.amount - charge.amount_refunded, charge.currency),
    currency: charge.currency.toUpperCase(),
    kind: charge.invoice ? "subscription" : "one_time",
  };
}

/** Stripe, read with a restricted key (rk_...) allowed to read Charges and Subscriptions, or a secret key. */
export class StripeSource implements RevenueSource {
  constructor(private readonly apiKey: string) {}

  private async get<T>(path: string, params: [string, string][], resource: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${STRIPE_API}${path}?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}`, "Stripe-Version": STRIPE_VERSION },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ProviderError("unavailable", "Stripe ne répond pas, réessaie dans un instant.");
    }

    if (response.ok) return (await response.json()) as T;
    if (response.status === 401) {
      throw new ProviderError("invalid_key", "Stripe refuse cette clé : vérifie qu'elle est complète et toujours active.");
    }
    if (response.status === 403) {
      throw new ProviderError("forbidden", `Cette clé n'a pas le droit de lire ${resource} : donne-lui l'accès en lecture dans Stripe.`);
    }
    if (response.status === 429) {
      throw new ProviderError("unavailable", "Stripe limite les requêtes pour le moment, réessaie dans une minute.");
    }
    throw new ProviderError("unavailable", "Stripe est momentanément indisponible, réessaie dans un instant.");
  }

  /** Every item of a list, newest first, up to `maxPages` pages. */
  private async list<T extends { id: string }>(path: string, params: [string, string][], resource: string, maxPages: number) {
    const items: T[] = [];
    let startingAfter: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const query: [string, string][] = [...params, ["limit", String(PAGE_SIZE)]];
      if (startingAfter) query.push(["starting_after", startingAfter]);
      const { data, has_more } = await this.get<StripeList<T>>(path, query, resource);
      items.push(...data);
      if (!has_more || data.length === 0) return { items, truncated: false };
      startingAfter = data[data.length - 1].id;
    }
    return { items, truncated: true };
  }

  async account(): Promise<ProviderAccount> {
    if (!/^(sk|rk)_(live|test)_/.test(this.apiKey)) {
      throw new ProviderError(
        "invalid_key",
        this.apiKey.startsWith("pk_")
          ? "C'est une clé publiable (pk_…) : il faut une clé restreinte (rk_…)."
          : "Une clé Stripe commence par rk_ (restreinte) ou sk_ (secrète).",
      );
    }
    const livemode = /^(sk|rk)_live_/.test(this.apiKey);

    try {
      const account = await this.get<StripeAccount>("/account", [], "le compte");
      const accountName = account.settings?.dashboard?.display_name || account.business_profile?.name || account.email || null;
      return { accountId: account.id, accountName, livemode };
    } catch (err) {
      // A restricted key without access to the account still reads payments: checked by the import.
      if (err instanceof ProviderError && err.kind === "forbidden") return { accountId: null, accountName: null, livemode };
      throw err;
    }
  }

  async fetch(since: number): Promise<RevenueData> {
    const [subscriptions, charges] = await Promise.all([
      this.list<StripeSubscription>("/subscriptions", [["status", "all"]], "les abonnements (Subscriptions)", MAX_SUBSCRIPTION_PAGES),
      this.list<StripeCharge>(
        "/charges",
        [["created[gte]", String(Math.floor(since / 1000))]],
        "les paiements (Charges)",
        MAX_CHARGE_PAGES,
      ),
    ]);

    return {
      subscriptions: subscriptions.items.map(normalizeStripeSubscription),
      payments: charges.items.flatMap((charge) => normalizeStripeCharge(charge) ?? []),
      truncated: subscriptions.truncated || charges.truncated,
    };
  }
}
