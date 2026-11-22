import { describe, expect, test } from "bun:test";
import { MAX_CREDIT_DAYS, upgradeCreditDays } from "./upgrade-credit";

const now = new Date("2026-11-13T12:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
const base = { now, oldPrice: 10, oldPeriodDays: 30, newPrice: 20, newPeriodDays: 30 };

describe("upgradeCreditDays", () => {
  test("converts the unused Starter value into Pro days", () => {
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: inDays(15) })).toBe(8); // 5 € → 7.5 days
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: inDays(30) })).toBe(15);
  });

  test("uses each plan's own period length", () => {
    // 7 days left of a 3 €/7 days plan = 3 € = 4.5 days of a 20 €/30 days plan.
    expect(upgradeCreditDays({ ...base, oldPrice: 3, oldPeriodDays: 7, oldPeriodEnd: inDays(7) })).toBe(5);
  });

  test("gives nothing once the period is over or almost", () => {
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: inDays(-2) })).toBe(0);
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: inDays(0.5) })).toBe(0);
  });

  test("gives nothing when prices or periods are unknown or free", () => {
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: null })).toBe(0);
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: "not a date" })).toBe(0);
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: inDays(15), oldPrice: 0 })).toBe(0);
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: inDays(15), newPrice: 0 })).toBe(0);
    expect(upgradeCreditDays({ ...base, oldPeriodEnd: inDays(15), oldPeriodDays: null })).toBe(0);
  });

  test("caps at Whop's extension limit", () => {
    expect(upgradeCreditDays({ ...base, oldPrice: 1000, oldPeriodEnd: inDays(30) })).toBe(MAX_CREDIT_DAYS);
  });
});
