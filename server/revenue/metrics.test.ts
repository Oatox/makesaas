import { describe, expect, test } from "bun:test";
import { SERIES_DAYS, type RevenueSnapshot } from "@shared/revenue";
import { buildOverview, buildSnapshot, DAY_MS, earliest, type NormalizedSubscription } from "./metrics";
import { normalizeStripeCharge, normalizeStripeSubscription } from "./providers/stripe";
import { monthsForDays } from "./providers/types";

const NOW = Date.parse("2026-11-23T15:00:00Z");
const TODAY = SERIES_DAYS - 1;
const daysAgo = (days: number) => NOW - days * DAY_MS;

const subscription = (overrides: Partial<NormalizedSubscription>): NormalizedSubscription => ({
  currency: "EUR",
  monthlyAmount: 20,
  paidFrom: daysAgo(100),
  endedAt: null,
  trialing: false,
  ...overrides,
});

describe("buildSnapshot", () => {
  test("rebuilds MRR and subscribers day by day", () => {
    const snapshot = buildSnapshot(
      {
        subscriptions: [
          subscription({}),
          subscription({ monthlyAmount: 10, paidFrom: daysAgo(10) }),
          // Churned 5 days ago: counted until the day before.
          subscription({ monthlyAmount: 30, paidFrom: daysAgo(400), endedAt: daysAgo(5) }),
          // Cancelled during its trial: never paid.
          subscription({ paidFrom: daysAgo(3), endedAt: daysAgo(20) }),
          subscription({ paidFrom: null, trialing: true }),
          subscription({ monthlyAmount: 0 }),
        ],
        payments: [],
        truncated: false,
      },
      NOW,
    );

    const { mrr } = snapshot.byCurrency.EUR;
    expect(mrr[TODAY]).toBe(30);
    expect(mrr[TODAY - 7]).toBe(60);
    expect(mrr[TODAY - 50]).toBe(50);
    expect(mrr[TODAY - 150]).toBe(30);
    expect(mrr[0]).toBe(30);
    expect(snapshot.subscribers[TODAY]).toBe(2);
    expect(snapshot.subscribers[TODAY - 7]).toBe(3);
    expect(snapshot.newSubscriptions[TODAY - 10]).toBe(1);
    expect(snapshot.newSubscriptions[TODAY - 100]).toBe(1);
    expect(snapshot.churnedSubscriptions[TODAY - 5]).toBe(1);
    expect(snapshot.churnedSubscriptions.reduce((a, b) => a + b)).toBe(1);
    expect(snapshot.trialing).toBe(1);
    expect(snapshot.seriesStart).toBe("2025-11-24");
  });

  test("adds payments per day and currency, keeps the latest ones", () => {
    const snapshot = buildSnapshot(
      {
        subscriptions: [],
        payments: [
          { date: daysAgo(0), amount: 19.99, currency: "EUR", kind: "renewal" },
          { date: daysAgo(0), amount: 10, currency: "EUR", kind: "one_time" },
          { date: daysAgo(2), amount: 50, currency: "USD", kind: "new_subscription" },
          // Fully refunded, then too old for the series.
          { date: daysAgo(1), amount: 0, currency: "EUR", kind: "renewal" },
          { date: daysAgo(SERIES_DAYS + 3), amount: 99, currency: "EUR", kind: null },
        ],
        truncated: true,
      },
      NOW,
    );

    expect(snapshot.byCurrency.EUR.revenue[TODAY]).toBe(29.99);
    expect(snapshot.byCurrency.USD.revenue[TODAY - 2]).toBe(50);
    expect(snapshot.byCurrency.EUR.revenue.reduce((a, b) => a + b)).toBe(29.99);
    expect(snapshot.recentPayments.map((payment) => payment.amount)).toEqual([19.99, 10, 50, 99]);
    expect(snapshot.truncated).toBe(true);
  });

  test("keeps when a checkout first went through (the payment test), even a free one", () => {
    const empty = { subscriptions: [], payments: [], truncated: false };
    expect(buildSnapshot(empty, NOW).firstCheckoutAt).toBeNull();
    expect(buildSnapshot({ ...empty, firstCheckoutAt: null }, NOW).firstCheckoutAt).toBeNull();
    expect(buildSnapshot({ ...empty, firstCheckoutAt: daysAgo(2) }, NOW).firstCheckoutAt).toBe(new Date(daysAgo(2)).toISOString());
  });
});

test("earliest: the first of the valid times", () => {
  expect(earliest([])).toBeNull();
  expect(earliest([Number.NaN])).toBeNull();
  expect(earliest([30, Number.NaN, 10, 20])).toBe(10);
});

describe("buildOverview", () => {
  const snapshotWith = (currency: string, mrr: number, revenuePerDay: number, now = NOW): RevenueSnapshot =>
    buildSnapshot(
      {
        subscriptions: [subscription({ currency, monthlyAmount: mrr })],
        payments: Array.from({ length: 40 }, (_, day) => ({ date: now - day * DAY_MS, amount: revenuePerDay, currency, kind: null })),
        truncated: false,
      },
      now,
    );

  test("converts every account to the main currency", () => {
    const overview = buildOverview(
      [
        { connectionId: "a", provider: "stripe", label: "Stripe", snapshot: snapshotWith("EUR", 1000, 30) },
        { connectionId: "b", provider: "whop", label: "Whop", snapshot: snapshotWith("USD", 220, 11) },
      ],
      { EUR: 1, USD: 1.1 },
      NOW,
    )!;

    expect(overview.currency).toBe("EUR");
    expect(overview.mrr[TODAY]).toBe(1200);
    expect(overview.revenue[TODAY]).toBe(40);
    expect(overview.subscribers[TODAY]).toBe(2);
    expect(overview.byConnection).toEqual([
      { connectionId: "a", mrr: 1000, revenue30d: 900 },
      { connectionId: "b", mrr: 200, revenue30d: 300 },
    ]);
    expect(overview.warnings).toEqual(["Montants en USD convertis en EUR au taux de référence du jour (BCE)."]);
  });

  test("leaves out the currencies without a rate, with a warning", () => {
    const overview = buildOverview(
      [
        { connectionId: "a", provider: "stripe", label: "Stripe", snapshot: snapshotWith("EUR", 100, 5) },
        { connectionId: "b", provider: "whop", label: "Whop", snapshot: snapshotWith("XYZ", 100, 5) },
      ],
      { EUR: 1 },
      NOW,
    )!;

    expect(overview.mrr[TODAY]).toBe(100);
    expect(overview.warnings).toEqual(["Les montants en XYZ ne sont pas comptés : leur taux de change vers EUR est indisponible."]);
  });


  test("shifts a snapshot synced on an earlier day", () => {
    const overview = buildOverview(
      [{ connectionId: "a", provider: "stripe", label: "Stripe", snapshot: snapshotWith("EUR", 100, 5, daysAgo(2)) }],
      null,
      NOW,
    )!;

    // MRR carries its last value forward; revenue is unknown on the days not synced.
    expect(overview.mrr[TODAY]).toBe(100);
    expect(overview.revenue[TODAY]).toBe(0);
    expect(overview.revenue[TODAY - 2]).toBe(5);
  });

  test("is null without any synced account", () => {
    expect(buildOverview([], null, NOW)).toBeNull();
  });
});

describe("Stripe normalization", () => {
  test("normalizes the price to a month, applies the coupon and skips metered items", () => {
    const normalized = normalizeStripeSubscription({
      id: "sub_1",
      status: "active",
      currency: "eur",
      start_date: 1_700_000_000,
      trial_end: 1_700_604_800,
      ended_at: null,
      items: {
        data: [
          { quantity: 2, price: { unit_amount: 12000, unit_amount_decimal: "12000", recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } } },
          { price: { unit_amount: 5, unit_amount_decimal: "5", recurring: { interval: "month", interval_count: 1, usage_type: "metered" } } },
        ],
      },
      discount: { coupon: { percent_off: 25, amount_off: null, currency: null } },
    });

    expect(normalized).toEqual({ currency: "EUR", monthlyAmount: 15, paidFrom: 1_700_604_800_000, endedAt: null, trialing: false });
  });

  test("leaves out subscriptions that never paid", () => {
    const normalized = normalizeStripeSubscription({
      id: "sub_2",
      status: "incomplete_expired",
      currency: "jpy",
      start_date: 1_700_000_000,
      trial_end: null,
      ended_at: 1_700_086_400,
      items: { data: [{ price: { unit_amount: 1000, unit_amount_decimal: "1000", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } } }] },
      discount: null,
    });
    expect(normalized.paidFrom).toBeNull();
    expect(normalized.monthlyAmount).toBe(1000);
  });

  test("counts succeeded charges net of refunds", () => {
    const charge = { id: "ch_1", amount: 2999, amount_refunded: 1000, currency: "usd", created: 1_700_000_000, paid: true, invoice: "in_1" };
    expect(normalizeStripeCharge({ ...charge, status: "succeeded" })).toEqual({
      date: 1_700_000_000_000,
      amount: 19.99,
      currency: "USD",
      kind: "subscription",
    });
    expect(normalizeStripeCharge({ ...charge, status: "failed", paid: false })).toBeNull();
  });
});

test("monthsForDays snaps to the usual billing periods", () => {
  expect(monthsForDays(30)).toBe(1);
  expect(monthsForDays(31)).toBe(1);
  expect(monthsForDays(90)).toBe(3);
  expect(monthsForDays(365)).toBe(12);
  expect(monthsForDays(7)).toBeCloseTo(12 / 52);
  expect(monthsForDays(45)).toBeCloseTo(45 / (365 / 12));
});
