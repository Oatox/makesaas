import { z } from "zod";

/**
 * Revenue dashboard (Tableau de bord): the member connects the payment accounts of each of their SaaS
 * (Stripe, Whop) with a read-only API key; the server reads their subscriptions and payments, and
 * the dashboard shows the active SaaS's MRR, revenue, subscribers and churn over time.
 *
 * To add a provider: its key here, a RevenueSource in server/revenue/providers/, its case in
 * createRevenueSource (server/revenue/providers/index.ts), its CHECK value in supabase_setup.sql,
 * and its card in client/src/components/revenue/providers.tsx.
 */

export const REVENUE_PROVIDERS = ["stripe", "whop"] as const;
export type RevenueProvider = (typeof REVENUE_PROVIDERS)[number];

export const REVENUE_PROVIDER_NAMES: Record<RevenueProvider, string> = {
  stripe: "Stripe",
  whop: "Whop",
};

/** Days covered by the daily series, today included (the dashboard offers up to 12 months). */
export const SERIES_DAYS = 365;

/**
 * A SaaS connects a single payment account (unique index revenue_connections_saas_key): to use
 * another one, the member disconnects the first. Reconnecting the same account changes its key.
 */
export const ALREADY_CONNECTED_MESSAGE = "Ce SaaS a déjà un compte de paiement connecté. Déconnecte-le pour en connecter un autre.";

export const API_KEY_MAX_LENGTH = 500;

/** Every route works on one SaaS of the member (the active one in the sidebar). */
const saasIdField = z.string().uuid("SaaS invalide");
export const revenueSaasSchema = z.object({ saasId: saasIdField });
export type RevenueSaasParams = z.infer<typeof revenueSaasSchema>;

export const connectRevenueBodySchema = z.object({
  saasId: saasIdField,
  provider: z.enum(REVENUE_PROVIDERS, { errorMap: () => ({ message: "Fournisseur non pris en charge" }) }),
  apiKey: z
    .string()
    .trim()
    .min(10, "Cette clé est trop courte")
    .max(API_KEY_MAX_LENGTH, "Cette clé est trop longue")
    .refine((value) => !/\s/.test(value), "La clé ne doit pas contenir d'espace"),
});
export type ConnectRevenueBody = z.infer<typeof connectRevenueBodySchema>;

/** Why a payment was made, when the provider says it. */
export type PaymentKind = "new_subscription" | "renewal" | "subscription" | "one_time";

export type RecentPayment = {
  /** ISO 8601. */
  date: string;
  /** Major units (29.99), refunds deducted. */
  amount: number;
  /** ISO 4217, uppercase. */
  currency: string;
  kind: PaymentKind | null;
};

/** Daily series in one currency, SERIES_DAYS long, oldest day first. Major units. */
export type CurrencySeries = {
  /** Payments collected that day, refunds deducted. */
  revenue: number[];
  /** Monthly recurring revenue at the end of that day. */
  mrr: number[];
};

/**
 * What a sync of one connected account computes (revenue_connections.snapshot). Built by the
 * server from the provider's subscriptions and payments; the dashboard combines the snapshots of
 * every connected account.
 */
export type RevenueSnapshot = {
  version: 1;
  /** ISO 8601. */
  syncedAt: string;
  /** First day of the series (UTC), "YYYY-MM-DD". */
  seriesStart: string;
  byCurrency: Record<string, CurrencySeries>;
  /** Paying subscriptions at the end of each day. */
  subscribers: number[];
  /** Subscriptions that started paying that day. */
  newSubscriptions: number[];
  /** Paying subscriptions that ended that day. */
  churnedSubscriptions: number[];
  /** Subscriptions in a free trial now. */
  trialing: number;
  /** The latest payments, newest first. */
  recentPayments: RecentPayment[];
  /** The account has more history than a sync reads: the oldest figures may be incomplete. */
  truncated: boolean;
};

/** A connected account, as the client sees it (the encrypted key never leaves the server). */
export type RevenueConnection = {
  id: string;
  provider: RevenueProvider;
  account_name: string | null;
  /** False for a Stripe test key or a Whop sandbox key. */
  livemode: boolean;
  /** Last characters of the key, to recognize it. */
  key_hint: string;
  last_synced_at: string | null;
  /** Why the last sync failed (French, shown as is), null when it succeeded. */
  last_error: string | null;
  created_at: string;
};

export const REVENUE_CONNECTION_COLUMNS =
  "id, provider, account_name, livemode, key_hint, last_synced_at, last_error, created_at";

/** Every connected account combined, in one currency. Series as in RevenueSnapshot. */
export type RevenueOverview = {
  /** ISO 4217, uppercase: the currency most of the revenue is in, the others converted to it. */
  currency: string;
  seriesStart: string;
  revenue: number[];
  mrr: number[];
  subscribers: number[];
  newSubscriptions: number[];
  churnedSubscriptions: number[];
  trialing: number;
  /** Newest first, in their own currency. */
  recentPayments: (RecentPayment & { connectionId: string; provider: RevenueProvider })[];
  /** MRR and revenue of the last 30 days of each account, converted. */
  byConnection: { connectionId: string; mrr: number; revenue30d: number }[];
  /** Amounts that could not be converted, history cut short... (French, shown as is). */
  warnings: string[];
};

export type RevenueDashboard = {
  connections: RevenueConnection[];
  /** Null until an account is connected and synced. */
  overview: RevenueOverview | null;
  /** Accounts being synced in the background: the client polls until it is empty. */
  syncing: string[];
};

export const revenueApi = {
  /** GET (query RevenueSaasParams): the SaaS's connections and combined overview; stale accounts are re-synced in the background. */
  dashboard: { path: "/api/revenue" },
  /** POST (body RevenueSaasParams): re-syncs every account of the SaaS now. */
  refresh: { path: "/api/revenue/refresh" },
  /** POST (body ConnectRevenueBody): checks the key, imports the account into the SaaS, returns RevenueConnection. */
  connect: { path: "/api/revenue/connections" },
} as const;
