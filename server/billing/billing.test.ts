import { describe, expect, test } from "bun:test";
import { renewsBilling, subscriptionStateOf } from "@shared/billing";

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

describe("subscriptionStateOf", () => {
  const whop = (status: string, cancel_at_period_end = false) => ({ provider: "whop" as const, status, cancel_at_period_end });

  test("with access: paid and renewing, granted by an admin, renewal cancelled, payment being retried", () => {
    expect(subscriptionStateOf(whop("active"))).toBe("active");
    expect(subscriptionStateOf(whop("trialing"))).toBe("active");
    expect(subscriptionStateOf(whop("completed"))).toBe("active");
    expect(subscriptionStateOf({ provider: "manual", status: "active", cancel_at_period_end: false })).toBe("manual");
    expect(subscriptionStateOf(whop("active", true))).toBe("ending");
    expect(subscriptionStateOf(whop("canceling"))).toBe("ending");
    expect(subscriptionStateOf(whop("past_due", true))).toBe("past_due");
  });

  test("without access: a subscription that ended, or none", () => {
    expect(subscriptionStateOf(whop("expired"))).toBe("ended");
    expect(subscriptionStateOf(whop("canceled", true))).toBe("ended");
    expect(subscriptionStateOf({ provider: "manual", status: "expired", cancel_at_period_end: false })).toBe("ended");
    expect(subscriptionStateOf(null)).toBe("none");
  });
});
