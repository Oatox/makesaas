import { beforeEach, describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhopConfig } from "./config";
import { BillingService, USER_ID_METADATA_KEY } from "./service";

const PLAN_ID = "plan_app";
const USER_ID = "user-1";

type Membership = {
  id: string;
  variant_id: string;
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
    status,
    user_id: "whop_user",
    metadata: { [USER_ID_METADATA_KEY]: USER_ID },
    current_period_end: "2026-12-22T00:00:00.000Z",
    cancel_at_period_end: false,
    manage_url: `https://whop.com/manage/${id}`,
    ...overrides,
  };
}

/** In-memory Whop memberships and Supabase tables, covering only the calls BillingService makes. */
function setup() {
  const memberships = new Map<string, Membership>();
  const subscriptions = new Map<string, SubscriptionRow>();
  const profiles = new Set([USER_ID]);

  const whop = {
    environment: "sandbox",
    webhookSecret: "ws_test",
    planId: PLAN_ID,
    client: {
      memberships: {
        retrieve: async ({ id }: { id: string }) => {
          const found = memberships.get(id);
          if (!found) throw new Error(`Unknown membership ${id}`);
          return found;
        },
      },
      checkoutConfigurations: { create: async () => ({ id: "ch_1" }) },
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

  return { billing: new BillingService(whop, db), memberships, subscriptions };
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

  test("a membership on another Whop plan is ignored", async () => {
    add(membership("mem_1", "active", { variant_id: "plan_other_product" }));
    await env.billing.syncMembership("mem_1");
    expect(row()).toBeUndefined();
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
    await expect(billing.createCheckout(USER_ID)).rejects.toMatchObject({ status: 409 });
  });

  test("returns a checkout session otherwise", async () => {
    const { billing } = setup();
    expect(await billing.createCheckout(USER_ID)).toEqual({ sessionId: "ch_1" });
  });
});
