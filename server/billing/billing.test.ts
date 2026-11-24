import { describe, expect, test } from "bun:test";
import { renewsBilling } from "@shared/billing";

describe("renewsBilling", () => {
  test("a running Whop subscription whose renewal is not cancelled bills again", () => {
    expect(renewsBilling({ provider: "whop", status: "active", cancel_at_period_end: false })).toBe(true);
    expect(renewsBilling({ provider: "whop", status: "past_due", cancel_at_period_end: false })).toBe(true);
  });

  test("a cancelled renewal, an ended subscription or a manual grant does not", () => {
    expect(renewsBilling({ provider: "whop", status: "active", cancel_at_period_end: true })).toBe(false);
    expect(renewsBilling({ provider: "whop", status: "expired", cancel_at_period_end: false })).toBe(false);
    expect(renewsBilling({ provider: "manual", status: "active", cancel_at_period_end: false })).toBe(false);
    expect(renewsBilling(null)).toBe(false);
  });
});
