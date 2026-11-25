import { beforeEach, describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhopCatalog, WhopConfig } from "./config";
import { BillingService, USER_ID_METADATA_KEY } from "./service";

const PRODUCT_ID = "prod_app";
const PLAN_ID = "plan_app";
const ANNUAL_PLAN_ID = "plan_app_annual";
const USER_ID = "user-1";

/** The product's plans on Whop: monthly and annual (with an older annual price), no quarterly one. */
const PRODUCT_PLANS = [
  { id: PLAN_ID, billing_period: 30, renewal_price: 18.99, initial_price: 0, currency: "eur", created_at: "2026-01-01T00:00:00Z" },
  { id: "plan_old_annual", billing_period: 365, renewal_price: 59.99, initial_price: 0, currency: "eur", created_at: "2025-06-01T00:00:00Z" },
  { id: ANNUAL_PLAN_ID, billing_period: 365, renewal_price: 69.99, initial_price: 0, currency: "eur", created_at: "2026-01-02T00:00:00Z" },
  { id: "plan_weekly", billing_period: 7, renewal_price: 4.99, initial_price: 0, currency: "eur", created_at: "2026-01-03T00:00:00Z" },
];

type Membership = {
  id: string;
  variant_id: string;
  product_id: string;
  status: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  manage_url: string | null;
};

type SubscriptionRow = Record<string, unknown> & { user_id: string; status: string; whop_membership_id: string | null };

function membership(id: string, status: string, overrides: Partial<Membership> = {}): Membership {
  return {
    id,
    variant_id: PLAN_ID,
    product_id: PRODUCT_ID,
    status,
    user_id: "whop_user",
    metadata: { [USER_ID_METADATA_KEY]: USER_ID },
    current_period_end: "2026-12-22T00:00:00.000Z",
    cancel_at_period_end: false,
    manage_url: `https://whop.com/manage/${id}`,
    ...overrides,
  };
}

/**
 * In-memory Whop memberships and Supabase tables, covering only the calls BillingService makes. Sells
 * the product by default; `{ kind: "plan" }` sells the single monthly plan.
 */
function setup(catalog: WhopCatalog = { kind: "product", productId: PRODUCT_ID }, { whopDown = false } = {}) {
  const memberships = new Map<string, Membership>();
  const subscriptions = new Map<string, SubscriptionRow>();
  const profiles = new Set([USER_ID]);
  const checkouts: { variant_id: string }[] = [];
  const canceled: string[] = [];

  const whop = {
    environment: "sandbox",
    webhookSecret: "ws_test",
    catalog,
    client: {
      memberships: {
        retrieve: async ({ id }: { id: string }) => {
          const found = memberships.get(id);
          if (!found) throw new Error(`Unknown membership ${id}`);
          return found;
        },
        update: async ({ id, cancel_at_period_end }: { id: string; cancel_at_period_end: boolean }) => {
          const found = memberships.get(id);
          if (whopDown || !found) throw new Error("Whop unreachable");
          found.cancel_at_period_end = cancel_at_period_end;
          return found;
        },
        // Without cancel_at_period_end, Whop ends the membership at once.
        cancel: async ({ id }: { id: string }) => {
          const found = memberships.get(id);
          if (whopDown || !found) throw new Error("Whop unreachable");
          found.status = "canceled";
          canceled.push(id);
          return found;
        },
      },
      variants: {
        retrieve: async ({ id }: { id: string }) => {
          const found = PRODUCT_PLANS.find((plan) => plan.id === id);
          if (whopDown || !found) throw new Error("Whop unreachable");
          return found;
        },
        list: async ({ product_ids }: { product_ids: string[] }) => {
          if (whopDown) throw new Error("Whop unreachable");
          const plans = product_ids.includes(PRODUCT_ID) ? PRODUCT_PLANS : [];
          // A page, iterated with for await.
          return {
            async *[Symbol.asyncIterator]() {
              yield* plans;
            },
          };
        },
      },
      checkoutConfigurations: {
        create: async (params: { variant_id: string }) => {
          checkouts.push(params);
          return { id: `ch_${checkouts.length}` };
        },
      },
    },
  } as unknown as WhopConfig;

  const db = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const rows = (): Record<string, unknown>[] =>
        table === "profiles" ? [...profiles].map((id) => ({ id })) : [...subscriptions.values()];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        },
        maybeSingle: async () => ({
          data: rows().find((row) => filters.every(([column, value]) => row[column] === value)) ?? null,
          error: null,
        }),
        upsert: async (row: SubscriptionRow) => {
          subscriptions.set(row.user_id, { ...subscriptions.get(row.user_id), ...row });
          return { error: null };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;

  return { billing: new BillingService(whop, db), memberships, subscriptions, checkouts, canceled };
}

describe("BillingService.syncMembership", () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    env = setup();
  });

  const row = () => env.subscriptions.get(USER_ID);
  const add = (m: Membership) => env.memberships.set(m.id, m);

  test("a first paid membership creates the subscription row", async () => {
    add(membership("mem_1", "active"));
    await env.billing.syncMembership("mem_1");
    expect(row()).toMatchObject({ status: "active", provider: "whop", whop_membership_id: "mem_1" });
  });

  test("a membership on any plan of the product (an older price too) is applied", async () => {
    add(membership("mem_1", "active", { variant_id: "plan_old_annual" }));
    await env.billing.syncMembership("mem_1");
    expect(row()).toMatchObject({ status: "active", whop_membership_id: "mem_1" });
  });

  test("a membership on another Whop product is ignored", async () => {
    add(membership("mem_1", "active", { variant_id: "plan_other", product_id: "prod_other" }));
    await env.billing.syncMembership("mem_1");
    expect(row()).toBeUndefined();
  });

  test("with a single plan, only that plan's memberships are applied", async () => {
    env = setup({ kind: "plan", planId: PLAN_ID });
    add(membership("mem_1", "active", { variant_id: ANNUAL_PLAN_ID }));
    await env.billing.syncMembership("mem_1");
    expect(row()).toBeUndefined();
    add(membership("mem_2", "active"));
    await env.billing.syncMembership("mem_2");
    expect(row()).toMatchObject({ status: "active", whop_membership_id: "mem_2" });
  });

  test("a membership without a known user is ignored", async () => {
    add(membership("mem_1", "active", { metadata: null }));
    await env.billing.syncMembership("mem_1");
    expect(row()).toBeUndefined();
  });

  test("the row's own membership ending removes access", async () => {
    add(membership("mem_1", "active"));
    await env.billing.syncMembership("mem_1");
    add(membership("mem_1", "canceled"));
    await env.billing.syncMembership("mem_1");
    expect(row()).toMatchObject({ status: "canceled", whop_membership_id: "mem_1" });
  });

  test("a new subscription after an ended one takes the row over", async () => {
    add(membership("mem_1", "expired"));
    env.subscriptions.set(USER_ID, { user_id: USER_ID, status: "expired", whop_membership_id: "mem_1" });
    add(membership("mem_2", "active"));
    await env.billing.syncMembership("mem_2");
    expect(row()).toMatchObject({ status: "active", whop_membership_id: "mem_2" });
  });

  test("an old membership ending does not touch the current one", async () => {
    add(membership("mem_1", "expired"));
    add(membership("mem_2", "active"));
    await env.billing.syncMembership("mem_2");
    await env.billing.syncMembership("mem_1");
    expect(row()).toMatchObject({ status: "active", whop_membership_id: "mem_2" });
  });

  test("a second membership while the first still runs on Whop is a duplicate, left aside", async () => {
    add(membership("mem_1", "active"));
    await env.billing.syncMembership("mem_1");
    add(membership("mem_2", "active"));
    await env.billing.syncMembership("mem_2");
    expect(row()).toMatchObject({ status: "active", whop_membership_id: "mem_1" });
  });

  test("a stale row whose membership already ended on Whop is taken over", async () => {
    // The row still says active: the event ending mem_1 was missed.
    env.subscriptions.set(USER_ID, { user_id: USER_ID, status: "active", whop_membership_id: "mem_1" });
    add(membership("mem_1", "expired"));
    add(membership("mem_2", "active"));
    await env.billing.syncMembership("mem_2");
    expect(row()).toMatchObject({ status: "active", whop_membership_id: "mem_2" });
  });

  test("a paid membership takes over a manual grant", async () => {
    env.subscriptions.set(USER_ID, { user_id: USER_ID, status: "active", provider: "manual", whop_membership_id: null });
    add(membership("mem_1", "active"));
    await env.billing.syncMembership("mem_1");
    expect(row()).toMatchObject({ status: "active", provider: "whop", whop_membership_id: "mem_1" });
  });
});

describe("BillingService.createCheckout", () => {
  test("refuses a user who already has access", async () => {
    const { billing, subscriptions } = setup();
    subscriptions.set(USER_ID, { user_id: USER_ID, status: "active", whop_membership_id: "mem_1" });
    await expect(billing.createCheckout(USER_ID, "monthly")).rejects.toMatchObject({ status: 409 });
  });

  test("returns a checkout session on the offer's Whop plan otherwise", async () => {
    const { billing, checkouts } = setup();
    expect(await billing.createCheckout(USER_ID, "annual")).toEqual({ sessionId: "ch_1" });
    expect(checkouts[0]).toMatchObject({ variant_id: ANNUAL_PLAN_ID });
  });

  test("refuses an offer without a Whop plan", async () => {
    const { billing, checkouts } = setup();
    await expect(billing.createCheckout(USER_ID, "quarterly")).rejects.toMatchObject({ status: 400 });
    expect(checkouts).toHaveLength(0);
  });
});

describe("BillingService.setCancelAtPeriodEnd", () => {
  test("cancelling stops the renewal on Whop and in the row, access stays; resuming restarts it", async () => {
    const env = setup();
    env.memberships.set("mem_1", membership("mem_1", "active"));
    await env.billing.syncMembership("mem_1");

    await env.billing.setCancelAtPeriodEnd(USER_ID, true);
    expect(env.memberships.get("mem_1")?.cancel_at_period_end).toBe(true);
    expect(env.subscriptions.get(USER_ID)).toMatchObject({ status: "active", cancel_at_period_end: true });

    await env.billing.setCancelAtPeriodEnd(USER_ID, false);
    expect(env.subscriptions.get(USER_ID)).toMatchObject({ status: "active", cancel_at_period_end: false });
  });

  test("a user without a running Whop subscription (a manual grant) has nothing to manage", async () => {
    const env = setup();
    env.subscriptions.set(USER_ID, { user_id: USER_ID, status: "active", provider: "manual", whop_membership_id: null });
    await expect(env.billing.setCancelAtPeriodEnd(USER_ID, true)).rejects.toMatchObject({ status: 404 });
  });

  test("Whop refusing the change leaves the row as it was", async () => {
    const env = setup(undefined, { whopDown: true });
    env.memberships.set("mem_1", membership("mem_1", "active"));
    env.subscriptions.set(USER_ID, { user_id: USER_ID, status: "active", whop_membership_id: "mem_1", cancel_at_period_end: false });
    await expect(env.billing.setCancelAtPeriodEnd(USER_ID, true)).rejects.toMatchObject({ status: 502 });
    expect(env.subscriptions.get(USER_ID)).toMatchObject({ cancel_at_period_end: false });
  });
});

describe("BillingService.cancelMembershipNow", () => {
  test("ends a running Whop membership at once", async () => {
    const env = setup();
    env.memberships.set("mem_1", membership("mem_1", "active"));
    await env.billing.syncMembership("mem_1");

    expect(await env.billing.cancelMembershipNow(USER_ID, "test")).toBe(true);
    expect(env.canceled).toEqual(["mem_1"]);
    expect(env.memberships.get("mem_1")?.status).toBe("canceled");
  });

  test("ends a membership whose renewal was already stopped, as it still grants access", async () => {
    const env = setup();
    env.memberships.set("mem_1", membership("mem_1", "active", { cancel_at_period_end: true }));
    await env.billing.syncMembership("mem_1");

    expect(await env.billing.cancelMembershipNow(USER_ID, "test")).toBe(true);
    expect(env.canceled).toEqual(["mem_1"]);
  });

  test("has nothing to do for a manual grant or a membership already ended on Whop", async () => {
    const manual = setup();
    manual.subscriptions.set(USER_ID, { user_id: USER_ID, status: "active", provider: "manual", whop_membership_id: null });
    expect(await manual.billing.cancelMembershipNow(USER_ID, "test")).toBe(false);

    const ended = setup();
    ended.memberships.set("mem_1", membership("mem_1", "canceled"));
    // A stale row still says active: Whop itself is checked.
    ended.subscriptions.set(USER_ID, { user_id: USER_ID, status: "active", whop_membership_id: "mem_1" });
    expect(await ended.billing.cancelMembershipNow(USER_ID, "test")).toBe(false);
    expect(ended.canceled).toEqual([]);
  });

  test("Whop unreachable fails, so that the caller changes nothing", async () => {
    const env = setup(undefined, { whopDown: true });
    env.memberships.set("mem_1", membership("mem_1", "active"));
    env.subscriptions.set(USER_ID, { user_id: USER_ID, status: "active", whop_membership_id: "mem_1" });
    // retrieve still answers in the fake: cancel is the call that fails.
    await expect(env.billing.cancelMembershipNow(USER_ID, "test")).rejects.toMatchObject({ status: 502 });
    expect(env.memberships.get("mem_1")?.status).toBe("active");
  });
});

describe("BillingService.getPaywallOffers", () => {
  test("offers the product's plans by period, in order, the newest price of a period", async () => {
    const { billing } = setup();
    expect(await billing.getPaywallOffers()).toEqual([
      { key: "monthly", price: 18.99, currency: "eur" },
      { key: "annual", price: 69.99, currency: "eur" },
    ]);
  });

  test("a product without a 1, 3 or 12-month plan has no offer", async () => {
    const { billing } = setup({ kind: "product", productId: "prod_empty" });
    await expect(billing.getPaywallOffers()).rejects.toMatchObject({ status: 503 });
  });

  test("a product Whop cannot list has no offer, to retry", async () => {
    const { billing } = setup(undefined, { whopDown: true });
    await expect(billing.getPaywallOffers()).rejects.toMatchObject({ status: 502 });
  });

  test("a single plan is the monthly offer, without a price when Whop fails", async () => {
    expect(await setup({ kind: "plan", planId: PLAN_ID }).billing.getPaywallOffers()).toEqual([
      { key: "monthly", price: 18.99, currency: "eur" },
    ]);
    expect(await setup({ kind: "plan", planId: PLAN_ID }, { whopDown: true }).billing.getPaywallOffers()).toEqual([
      { key: "monthly", price: null, currency: null },
    ]);
  });
});
