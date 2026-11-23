import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { RevenueOverview } from "@shared/revenue";

export type PeriodKey = "30d" | "90d" | "12m";

export const PERIODS: { value: PeriodKey; label: string; days: number; /** "vs il y a 30 j" */ since: string }[] = [
  { value: "30d", label: "30 derniers jours", days: 30, since: "il y a 30 j" },
  { value: "90d", label: "90 derniers jours", days: 90, since: "il y a 90 j" },
  { value: "12m", label: "12 derniers mois", days: 365, since: "il y a 12 mois" },
];

export const periodOf = (key: PeriodKey) => PERIODS.find((period) => period.value === key)!;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
/** Relative change, null when there is nothing to compare with. */
const change = (now: number, before: number) => (before > 0 ? (now - before) / before : null);

export type PeriodStats = {
  mrr: number;
  mrrChange: number | null;
  revenue: number;
  /** Null when the series is too short to hold the previous period (12 months). */
  revenueChange: number | null;
  subscribers: number;
  newSubscriptions: number;
  /** Null when the series is too short to hold the previous period (12 months). */
  newSubscriptionsChange: number | null;
  churnedSubscriptions: number;
  /** Paying subscriptions lost over the period, out of those at its start. */
  churnRate: number | null;
  /** Average MRR per paying subscription. */
  arpu: number | null;
};

/** Headline figures over the last `days` days (the series end today). */
export function periodStats(overview: RevenueOverview, days: number): PeriodStats {
  const length = overview.mrr.length;
  const last = length - 1;
  const from = Math.max(0, length - days);
  // Level figures (MRR, subscribers) at the start: the end of the day before the period.
  const before = Math.max(0, from - 1);

  // The period before, of the same length: null when the series is too short to hold it (12 months).
  const previous = (values: number[]) => (length - 2 * days >= 0 ? sum(values.slice(length - 2 * days, from)) : null);

  const revenue = sum(overview.revenue.slice(from));
  const previousRevenue = previous(overview.revenue);
  const churnedSubscriptions = sum(overview.churnedSubscriptions.slice(from));
  const subscribersAtStart = overview.subscribers[before];
  const newSubscriptions = sum(overview.newSubscriptions.slice(from));
  const previousNewSubscriptions = previous(overview.newSubscriptions);

  return {
    mrr: overview.mrr[last],
    mrrChange: change(overview.mrr[last], overview.mrr[before]),
    revenue,
    revenueChange: previousRevenue === null ? null : change(revenue, previousRevenue),
    subscribers: overview.subscribers[last],
    newSubscriptions,
    newSubscriptionsChange: previousNewSubscriptions === null ? null : change(newSubscriptions, previousNewSubscriptions),
    churnedSubscriptions,
    churnRate: subscribersAtStart > 0 ? churnedSubscriptions / subscribersAtStart : null,
    arpu: overview.subscribers[last] > 0 ? overview.mrr[last] / overview.subscribers[last] : null,
  };
}

export type ChartPoint = {
  /** Axis label ("23 nov.", "nov."). */
  label: string;
  /** Tooltip and table label ("Semaine du 17 nov."). */
  title: string;
  value: number;
};

const dayFormat = (date: Date) => format(date, "d MMM", { locale: fr });

/** One point per day of the period, for the level series (MRR, subscribers). */
export function dailyPoints(overview: RevenueOverview, values: number[], days: number): ChartPoint[] {
  const start = parseISO(overview.seriesStart);
  const from = Math.max(0, values.length - days);
  return values.slice(from).map((value, offset) => {
    const date = addDays(start, from + offset);
    return { label: dayFormat(date), title: format(date, "EEEE d MMMM yyyy", { locale: fr }), value };
  });
}

/**
 * The period cut into days (30 days), weeks ending today (90 days) or calendar months (12 months).
 * `sumValues`: flows (revenue) add up over a bucket; levels (MRR) take its last day.
 */
export function bucketPoints(overview: RevenueOverview, values: number[], days: number, sumValues: boolean): ChartPoint[] {
  const start = parseISO(overview.seriesStart);
  const from = Math.max(0, values.length - days);
  const dateOf = (index: number) => addDays(start, index);
  const reduce = (slice: number[]) => (sumValues ? sum(slice) : (slice[slice.length - 1] ?? 0));

  if (days <= 31) return dailyPoints(overview, values, days);

  if (days <= 120) {
    const points: ChartPoint[] = [];
    for (let end = values.length; end > from; end -= 7) {
      const first = Math.max(from, end - 7);
      points.unshift({
        label: dayFormat(dateOf(first)),
        title: `Semaine du ${dayFormat(dateOf(first))} au ${dayFormat(dateOf(end - 1))}`,
        value: reduce(values.slice(first, end)),
      });
    }
    return points;
  }

  const months = new Map<string, { date: Date; values: number[] }>();
  for (let index = from; index < values.length; index++) {
    const date = dateOf(index);
    const key = format(date, "yyyy-MM");
    const month = months.get(key) ?? { date, values: [] };
    month.values.push(values[index]);
    months.set(key, month);
  }
  return Array.from(months.values()).map(({ date, values: monthValues }) => ({
    label: format(date, "MMM", { locale: fr }),
    title: format(date, "MMMM yyyy", { locale: fr }),
    value: reduce(monthValues),
  }));
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** "4 280 €", "29,99 €"; compact for axes ("4,3 k€"). */
export function formatMoney(amount: number, currency: string, { compact = false }: { compact?: boolean } = {}) {
  const decimals = compact ? 1 : Number.isInteger(amount) || Math.abs(amount) >= 1000 ? 0 : 2;
  const key = `${currency}-${compact}-${decimals}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        minimumFractionDigits: compact ? 0 : decimals,
        maximumFractionDigits: decimals,
      });
    } catch {
      // Unknown currency code: plain number then the code.
      formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals });
      return `${formatter.format(amount)} ${currency}`;
    }
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(amount);
}

export const formatCount = (value: number) => value.toLocaleString("fr-FR");

/** "+12,4 %", "−3 %", "0 %". */
export const formatChange = (ratio: number) =>
  new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(ratio);

export const formatRate = (ratio: number) =>
  new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(ratio);
