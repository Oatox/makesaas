import type { SupabaseClient } from "@supabase/supabase-js";
import type { RevenueOverview, RevenueProvider, RevenueSnapshot } from "@shared/revenue";
import { isCustomDomain, monthlyGoalOf, type MissionDone, type RoadmapStage, type RoadmapState } from "@shared/roadmap";
import { EARLIER_BUILD_MISSIONS, LATER_ADDED_MISSIONS, roadmapStagesFor } from "@shared/roadmap-missions";
import type { MissionProject } from "@shared/roadmap-prompts";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { getExchangeRates } from "../revenue/exchange-rates";
import { buildOverview, DAY_MS, type ExchangeRates } from "../revenue/metrics";

/** What the SaaS's data says, for the missions that check themselves. */
export type MissionFacts = {
  saasCreatedAt: string;
  /** The address of their app, which the member gave, is on their own domain (isCustomDomain). */
  hasCustomDomain: boolean;
  /** The SaaS has a logo. */
  hasLogo: boolean;
  /** The member gave the Whop payment link of their app. */
  hasPaymentLink: boolean;
  /** A Stripe / Whop account is connected (live or test). */
  hasPaymentAccount: boolean;
  tiktokAccounts: number;
  /** When the SaaS's TikTok videos were posted, oldest first. */
  videoDates: string[];
  /** The live payment account over the last year, converted to its main currency; null without one. */
  revenue: Pick<RevenueOverview, "currency" | "seriesStart" | "revenue" | "mrr"> | null;
  /** Units of a currency per euro, to compare MRR in euros; null: amounts taken as is. */
  rates: ExchangeRates | null;
  /** Date of what is seen now without a date of its own (a count reached, an account connected). */
  now: string;
};

/**
 * The build tasks before the core (home page, accounts, onboarding) count as done, with its date, once
 * the core is (build:first_version): members who built their app with the former single prompt are
 * not sent back to them, and the others did them first anyway. Likewise a task added later
 * (LATER_ADDED_MISSIONS: "Valide ton app", "Relie Whop à ton app") once the one after it is. Not
 * saved, and not the member's to untick.
 */
export function withEarlierBuildMissions(done: Record<string, MissionDone>): Record<string, MissionDone> {
  const result = { ...done };
  const built = done["build:first_version"];
  if (built) for (const key of EARLIER_BUILD_MISSIONS) result[key] ??= { at: built.at, source: "observed" };
  for (const [key, after] of Object.entries(LATER_ADDED_MISSIONS)) {
    if (done[after]) result[key] ??= { at: done[after].at, source: "observed" };
  }
  return result;
}

/** The day of a daily series, as an ISO date (noon UTC: no time zone moves it to another day). */
const dayOf = (seriesStart: string, index: number) =>
  new Date(Date.parse(`${seriesStart}T12:00:00Z`) + index * DAY_MS).toISOString();

/**
 * The missions of `stages` that the data shows as done, with their date. Dated before the SaaS was
 * created on MakeSaaS: "before" (the member brought it along). Manual missions are never here.
 */
export function observedMissions(facts: MissionFacts, stages: RoadmapStage[]): Record<string, MissionDone> {
  const created = Date.parse(facts.saasCreatedAt);
  const seen = (at: string): MissionDone => ({ at, source: Date.parse(at) < created ? "before" : "observed" });
  const perEuro = facts.revenue ? (facts.rates?.[facts.revenue.currency] ?? 1) : 1;
  const firstPayment = facts.revenue ? facts.revenue.revenue.findIndex((amount) => amount > 0) : -1;

  const done: Record<string, MissionDone> = {};
  for (const mission of stages.flatMap((stage) => stage.missions)) {
    const check = mission.check;
    let result: MissionDone | null = null;
    switch (check.kind) {
      case "saas":
        result = { at: facts.saasCreatedAt, source: "declared" };
        break;
      case "custom_domain":
        result = facts.hasCustomDomain ? { at: facts.now, source: "declared" } : null;
        break;
      case "logo":
        result = facts.hasLogo ? { at: facts.now, source: "observed" } : null;
        break;
      case "payment_link":
        // Given by the member, like the app's address.
        result = facts.hasPaymentLink ? { at: facts.now, source: "declared" } : null;
        break;
      case "payment_account":
        result = facts.hasPaymentAccount ? { at: facts.now, source: "observed" } : null;
        break;
      case "tiktok_accounts":
        result = facts.tiktokAccounts >= check.min ? { at: facts.now, source: "observed" } : null;
        break;
      case "videos":
        result = facts.videoDates.length >= check.min ? seen(facts.videoDates[check.min - 1]) : null;
        break;
      case "first_payment":
        result = facts.revenue && firstPayment >= 0 ? seen(dayOf(facts.revenue.seriesStart, firstPayment)) : null;
        break;
      case "mrr": {
        const day = facts.revenue ? facts.revenue.mrr.findIndex((mrr) => mrr / perEuro >= check.amount) : -1;
        result = facts.revenue && day >= 0 ? seen(dayOf(facts.revenue.seriesStart, day)) : null;
        break;
      }
      case "manual":
        break;
    }
    if (result) done[mission.key] = result;
  }
  return done;
}

/** The MRR of the live account today (the series' last day), in whole euros; null without a live account. */
export function currentMrrInEuros(
  revenue: Pick<RevenueOverview, "currency" | "mrr"> | null,
  rates: ExchangeRates | null,
): number | null {
  if (!revenue) return null;
  const perEuro = rates?.[revenue.currency] ?? 1;
  return Math.round((revenue.mrr.at(-1) ?? 0) / perEuro);
}

type SaasRow = {
  id: string;
  name: string;
  description: string | null;
  audience: string | null;
  created_at: string;
  app_url: string | null;
  logo_url: string | null;
  payment_link: string | null;
  idea: { content?: { problem?: unknown; price?: unknown; feature?: unknown } } | null;
};

/** A text of the idea, trimmed; null when missing or empty (older ideas lack the newer fields). */
const ideaText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** What the tutorials' prompts say about the project. The idea is read as is: older ideas are longer than today's limits. */
export function projectOf(saas: SaasRow): MissionProject {
  const idea = saas.idea?.content;
  return {
    name: saas.name,
    description: saas.description,
    audience: saas.audience,
    problem: ideaText(idea?.problem),
    feature: ideaText(idea?.feature),
    price: typeof idea?.price === "number" && idea.price > 0 ? Math.round(idea.price * 100) / 100 : null,
    logoUrl: saas.logo_url,
    paymentLink: saas.payment_link,
  };
}

/**
 * The roadmap of a SaaS: checks its missions against its data, saves the newly done ones (never
 * undone, even when a connection breaks) and answers the whole state with the missions the member
 * ticked.
 */
export class RoadmapService {
  constructor(private readonly db: SupabaseClient) {}

  /** `save: false` checks without saving what it sees (an admin looking at a member's roadmap). */
  async state(userId: string, saasId: string, { save = true }: { save?: boolean } = {}): Promise<RoadmapState> {
    const saas = await this.ownSaas(userId, saasId);
    const profile = await this.db.from("profiles").select("monthly_goal").eq("id", userId).maybeSingle();
    if (profile.error) throw this.loadError(profile.error, saasId);
    const goal = monthlyGoalOf(profile.data?.monthly_goal);
    const stages = roadmapStagesFor(goal);
    const videosNeeded = Math.max(
      1,
      ...stages.flatMap((stage) => stage.missions.map((mission) => (mission.check.kind === "videos" ? mission.check.min : 0))),
    );

    const [saved, videos, connections, tiktok] = await Promise.all([
      this.db.from("roadmap_missions").select("key, done_at, source").eq("saas_id", saasId).eq("user_id", userId),
      this.db
        .from("tiktok_videos")
        // The first ones date the video milestones; the count is all of them.
        .select("posted_at", { count: "exact" })
        .eq("saas_id", saasId)
        .eq("user_id", userId)
        .order("posted_at", { ascending: true })
        .limit(videosNeeded),
      this.db.from("revenue_connections").select("id, provider, account_name, livemode, snapshot").eq("saas_id", saasId).eq("user_id", userId),
      this.db.from("tiktok_accounts").select("id", { count: "exact", head: true }).eq("saas_id", saasId).eq("user_id", userId),
    ]);
    const failed = saved.error ?? videos.error ?? connections.error ?? tiktok.error;
    if (failed) throw this.loadError(failed, saasId);

    // Test accounts (Stripe test key, Whop sandbox) never count for payments: they are not customers.
    const live = (connections.data ?? []).filter((row) => row.livemode && row.snapshot) as {
      id: string;
      provider: RevenueProvider;
      account_name: string | null;
      snapshot: RevenueSnapshot;
    }[];
    const rates = live.length ? await getExchangeRates() : null;
    const overview = buildOverview(
      live.map((row) => ({ connectionId: row.id, provider: row.provider, label: row.account_name ?? row.provider, snapshot: row.snapshot })),
      rates,
    );

    const done: Record<string, MissionDone> = {};
    for (const row of saved.data ?? []) done[row.key] = { at: row.done_at, source: row.source };

    const observed = observedMissions(
      {
        saasCreatedAt: saas.created_at,
        hasCustomDomain: isCustomDomain(saas.app_url),
        hasLogo: !!saas.logo_url,
        hasPaymentLink: !!saas.payment_link,
        hasPaymentAccount: (connections.data ?? []).length > 0,
        tiktokAccounts: tiktok.count ?? 0,
        videoDates: (videos.data ?? []).map((video) => video.posted_at),
        revenue: overview,
        rates,
        now: new Date().toISOString(),
      },
      stages,
    );

    const fresh = Object.entries(observed).filter(([key]) => !done[key]);
    if (fresh.length && save) {
      const { error } = await this.db.from("roadmap_missions").upsert(
        fresh.map(([key, value]) => ({ saas_id: saasId, user_id: userId, key, done_at: value.at, source: value.source })),
        { onConflict: "saas_id,key", ignoreDuplicates: true },
      );
      if (error) logger.error({ err: error, saasId }, "Failed to save the missions done");
    }
    for (const [key, value] of fresh) done[key] = value;

    return {
      goal,
      project: projectOf(saas),
      appUrl: saas.app_url,
      done: withEarlierBuildMissions(done),
      progress: {
        videos: videos.count ?? (videos.data ?? []).length,
        tiktokAccounts: tiktok.count ?? 0,
        mrr: currentMrrInEuros(overview, rates),
      },
    };
  }

  /** Saves the address of the member's app (checked by their browser), then answers the roadmap. */
  async setAppUrl(userId: string, saasId: string, url: string): Promise<RoadmapState> {
    await this.ownSaas(userId, saasId);
    const { error } = await this.db.from("saas").update({ app_url: url }).eq("id", saasId).eq("user_id", userId);
    if (error) {
      logger.error({ err: error, saasId }, "Failed to save the app address");
      throw new HttpError(500, "Impossible d'enregistrer l'adresse de ton app.");
    }
    return this.state(userId, saasId);
  }

  /** Saves the Whop payment link of the member's app (the payment prompt carries it), then answers the roadmap. */
  async setPaymentLink(userId: string, saasId: string, url: string): Promise<RoadmapState> {
    await this.ownSaas(userId, saasId);
    const { error } = await this.db.from("saas").update({ payment_link: url }).eq("id", saasId).eq("user_id", userId);
    if (error) {
      logger.error({ err: error, saasId }, "Failed to save the payment link");
      throw new HttpError(500, "Impossible d'enregistrer ton lien de paiement.");
    }
    return this.state(userId, saasId);
  }

  async ownSaas(userId: string, saasId: string): Promise<SaasRow> {
    const { data, error } = await this.db
      .from("saas")
      .select("id, name, description, audience, created_at, app_url, logo_url, payment_link, idea:saas_ideas(content)")
      .eq("id", saasId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      logger.error({ err: error, saasId }, "Failed to read a SaaS");
      throw new HttpError(500, "Impossible de lire ce SaaS.");
    }
    if (!data) throw new HttpError(404, "SaaS introuvable.");
    return data as unknown as SaasRow;
  }

  private loadError(err: unknown, saasId: string) {
    logger.error({ err, saasId }, "Failed to read the roadmap data");
    return new HttpError(500, "Impossible de charger ta roadmap.");
  }
}
