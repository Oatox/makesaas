import {
  SERIES_DAYS,
  type PaymentKind,
  type RevenueOverview,
  type RevenueProvider,
  type RevenueSnapshot,
} from "@shared/revenue";

export const DAY_MS = 86_400_000;

/** A subscription, as every provider reads it. Timestamps in ms. */
export type NormalizedSubscription = {
  /** ISO 4217, uppercase. */
  currency: string;
  /** Recurring revenue per month in major units, discounts applied; 0 for a free one. */
  monthlyAmount: number;
  /** When it started paying (after any trial); null when it never did or is still in trial. */
  paidFrom: number | null;
  /** When it stopped paying; null while it still pays (even if set to cancel at period end). */
  endedAt: number | null;
  /** In a free trial now. */
  trialing: boolean;
};

export type NormalizedPayment = {
  date: number;
  /** Major units, refunds deducted. */
  amount: number;
  /** ISO 4217, uppercase. */
  currency: string;
  kind: PaymentKind | null;
};

/** What a provider reads: every subscription (for the history) and the payments of the period. */
export type RevenueData = {
  subscriptions: NormalizedSubscription[];
  payments: NormalizedPayment[];
  /** A page limit was reached: the oldest figures may be incomplete. */
  truncated: boolean;
  /** The account, when the data names it (for keys that cannot read the account itself). */
  account?: { id: string; name: string | null };
  /**
   * When a checkout first went through on the account: a subscription taken (even a free one, with a
   * 100 % code) or a payment. The roadmap's payment test is seen there. Undefined: not read.
   */
  firstCheckoutAt?: number | null;
};

/** The earliest of these times (ms); null when there is none. */
export function earliest(times: number[]): number | null {
  let first: number | null = null;
  for (const time of times) if (Number.isFinite(time) && (first === null || time < first)) first = time;
  return first;
}

/** Units of a currency per euro (ECB reference rates), EUR included at 1. */
export type ExchangeRates = Record<string, number>;

const RECENT_PAYMENTS = 8;

const startOfUtcDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round2 = (value: number) => Math.round(value * 100) / 100;
const zeros = (length = SERIES_DAYS) => new Array<number>(length).fill(0);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** First day (UTC midnight) of the series ending today. */
export const seriesStartFor = (now: number) => startOfUtcDay(now) - (SERIES_DAYS - 1) * DAY_MS;

/** Running total of a difference array, cut to the series length. */
function accumulate(diff: number[]): number[] {
  let running = 0;
  return diff.slice(0, SERIES_DAYS).map((delta) => (running += delta));
}

/**
 * Daily series of one account: revenue from its payments, and MRR and subscribers rebuilt from its
 * subscriptions (a subscription counts on a day when it pays at the end of that day). The current
 * price of a subscription is applied to its whole history.
 */
export function buildSnapshot(data: RevenueData, now = Date.now()): RevenueSnapshot {
  const start = seriesStartFor(now);
  const dayOf = (ms: number) => Math.floor((ms - start) / DAY_MS);
  const inSeries = (day: number) => day >= 0 && day < SERIES_DAYS;

  const revenue = new Map<string, number[]>();
  const mrrDiff = new Map<string, number[]>();
  const seriesFor = (map: Map<string, number[]>, currency: string, length: number) => {
    let values = map.get(currency);
    if (!values) map.set(currency, (values = zeros(length)));
    return values;
  };

  for (const payment of data.payments) {
    const day = dayOf(payment.date);
    if (!inSeries(day) || payment.amount <= 0) continue;
    seriesFor(revenue, payment.currency, SERIES_DAYS)[day] += payment.amount;
  }

  const subscribersDiff = zeros(SERIES_DAYS + 1);
  const newSubscriptions = zeros();
  const churnedSubscriptions = zeros();
  let trialing = 0;

  for (const subscription of data.subscriptions) {
    if (subscription.trialing && subscription.endedAt === null) trialing++;

    const { paidFrom, monthlyAmount } = subscription;
    const endedAt = subscription.endedAt ?? Infinity;
    if (paidFrom === null || monthlyAmount <= 0 || paidFrom > now || endedAt <= paidFrom) continue;

    const first = Math.max(0, dayOf(paidFrom));
    const end = endedAt === Infinity ? SERIES_DAYS : Math.min(SERIES_DAYS, dayOf(endedAt));
    if (first < end) {
      const mrr = seriesFor(mrrDiff, subscription.currency, SERIES_DAYS + 1);
      mrr[first] += monthlyAmount;
      mrr[end] -= monthlyAmount;
      subscribersDiff[first]++;
      subscribersDiff[end]--;
    }

    if (inSeries(dayOf(paidFrom))) newSubscriptions[dayOf(paidFrom)]++;
    if (endedAt <= now && inSeries(dayOf(endedAt))) churnedSubscriptions[dayOf(endedAt)]++;
  }

  const byCurrency: RevenueSnapshot["byCurrency"] = {};
  for (const currency of Array.from(new Set(Array.from(revenue.keys()).concat(Array.from(mrrDiff.keys()))))) {
    byCurrency[currency] = {
      revenue: (revenue.get(currency) ?? zeros()).map(round2),
      mrr: (mrrDiff.has(currency) ? accumulate(mrrDiff.get(currency)!) : zeros()).map(round2),
    };
  }

  const recentPayments = data.payments
    .filter((payment) => payment.amount > 0 && payment.date <= now)
    .sort((a, b) => b.date - a.date)
    .slice(0, RECENT_PAYMENTS)
    .map((payment) => ({
      date: new Date(payment.date).toISOString(),
      amount: round2(payment.amount),
      currency: payment.currency,
      kind: payment.kind,
    }));

  return {
    version: 1,
    syncedAt: new Date(now).toISOString(),
    seriesStart: isoDay(start),
    byCurrency,
    subscribers: accumulate(subscribersDiff),
    newSubscriptions,
    churnedSubscriptions,
    trialing,
    recentPayments,
    truncated: data.truncated,
    firstCheckoutAt: data.firstCheckoutAt == null ? null : new Date(data.firstCheckoutAt).toISOString(),
  };
}

export type SnapshotSource = {
  connectionId: string;
  provider: RevenueProvider;
  /** Shown in the warnings. */
  label: string;
  snapshot: RevenueSnapshot;
};

/** Currencies the snapshots hold amounts in. */
export function currenciesOf(sources: SnapshotSource[]): Set<string> {
  return new Set(sources.flatMap((source) => Object.keys(source.snapshot.byCurrency)));
}

/**
 * Every account combined over the series ending today, in the currency most of the money is in
 * (the others converted with `rates`, dropped with a warning when a rate is missing). A snapshot
 * synced on an earlier day is shifted: its MRR and subscribers carry their last value forward,
 * its revenue counts nothing on the days it has not seen.
 */
export function buildOverview(sources: SnapshotSource[], rates: ExchangeRates | null, now = Date.now()): RevenueOverview | null {
  if (sources.length === 0) return null;

  const start = seriesStartFor(now);
  const align = (values: number[], seriesStart: string, carryForward: boolean) => {
    const shift = Math.round((start - Date.parse(`${seriesStart}T00:00:00Z`)) / DAY_MS);
    return Array.from({ length: SERIES_DAYS }, (_, day) => {
      const index = day + shift;
      if (index < 0) return 0;
      if (index < values.length) return values[index] ?? 0;
      return carryForward ? (values[values.length - 1] ?? 0) : 0;
    });
  };

  // The main currency: the largest share of yearly MRR + revenue, compared in euros.
  const weights = new Map<string, number>();
  for (const { snapshot } of sources) {
    for (const [currency, series] of Object.entries(snapshot.byCurrency)) {
      const amount = (series.mrr[series.mrr.length - 1] ?? 0) * 12 + sum(series.revenue);
      const inEuros = rates ? (rates[currency] ? amount / rates[currency] : 0) : amount;
      weights.set(currency, (weights.get(currency) ?? 0) + inEuros);
    }
  }
  const currency = Array.from(weights.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "EUR";

  const rateTo = (from: string): number | null => {
    if (from === currency) return 1;
    const fromRate = rates?.[from];
    const toRate = rates?.[currency];
    return fromRate && toRate ? toRate / fromRate : null;
  };

  const revenue = zeros();
  const mrr = zeros();
  const subscribers = zeros();
  const newSubscriptions = zeros();
  const churnedSubscriptions = zeros();
  const byConnection: RevenueOverview["byConnection"] = [];
  const unconverted = new Set<string>();
  const convertedFrom = new Set<string>();
  const warnings: string[] = [];
  let trialing = 0;

  for (const { connectionId, label, snapshot } of sources) {
    const add = (target: number[], values: number[], carryForward: boolean, factor = 1) =>
      align(values, snapshot.seriesStart, carryForward).forEach((value, day) => (target[day] += value * factor));

    add(subscribers, snapshot.subscribers, true);
    add(newSubscriptions, snapshot.newSubscriptions, false);
    add(churnedSubscriptions, snapshot.churnedSubscriptions, false);
    trialing += snapshot.trialing;

    const connectionRevenue = zeros();
    const connectionMrr = zeros();
    for (const [from, series] of Object.entries(snapshot.byCurrency)) {
      const factor = rateTo(from);
      if (factor === null) {
        if (sum(series.revenue) > 0 || series.mrr.some((value) => value > 0)) unconverted.add(from);
        continue;
      }
      if (from !== currency) convertedFrom.add(from);
      add(connectionRevenue, series.revenue, false, factor);
      add(connectionMrr, series.mrr, true, factor);
    }
    connectionRevenue.forEach((value, day) => (revenue[day] += value));
    connectionMrr.forEach((value, day) => (mrr[day] += value));
    byConnection.push({
      connectionId,
      mrr: round2(connectionMrr[SERIES_DAYS - 1]),
      revenue30d: round2(sum(connectionRevenue.slice(-30))),
    });

    if (snapshot.truncated) {
      warnings.push(`${label} a trop d'historique pour être lu en entier : les chiffres les plus anciens peuvent être incomplets.`);
    }
  }

  for (const from of Array.from(unconverted)) {
    warnings.push(`Les montants en ${from} ne sont pas comptés : leur taux de change vers ${currency} est indisponible.`);
  }
  if (convertedFrom.size > 0) {
    warnings.push(`Montants en ${Array.from(convertedFrom).join(", ")} convertis en ${currency} au taux de référence du jour (BCE).`);
  }

  const recentPayments = sources
    .flatMap(({ connectionId, provider, snapshot }) =>
      snapshot.recentPayments.map((payment) => ({ ...payment, connectionId, provider })),
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, RECENT_PAYMENTS);

  return {
    currency,
    seriesStart: isoDay(start),
    revenue: revenue.map(round2),
    mrr: mrr.map(round2),
    subscribers,
    newSubscriptions,
    churnedSubscriptions,
    trialing,
    recentPayments,
    byConnection,
    warnings,
  };
}
