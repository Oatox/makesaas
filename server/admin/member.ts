import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_DISCUSSIONS_LISTED, type AdminDiscussion, type AdminMemberJourney, type AdminSaasDetail } from "@shared/admin";
import { COACH_MESSAGE_COLUMNS, type CoachMessage } from "@shared/coach";
import { onboardingProfileSchema } from "@shared/onboarding-profile";
import type { RevenueProvider, RevenueSnapshot } from "@shared/revenue";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { getExchangeRates } from "../revenue/exchange-rates";
import { buildOverview, DAY_MS } from "../revenue/metrics";
import { projectOf, RoadmapService } from "../roadmap/service";

/** A member's journey and SaaS for their admin page (shared/admin.ts). Reads only. */

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function unwrap<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error) {
    logger.error({ err: result.error, what }, "Failed to read a member's data");
    throw new HttpError(500, "Impossible de charger les données du membre.");
  }
  return result.data as T;
}

/** The profile columns the journey reads, on top of the admin page's own. */
export const JOURNEY_PROFILE_COLUMNS = "monthly_goal,onboarding_profile,current_saas_id";

export async function readJourney(
  db: SupabaseClient,
  userId: string,
  profile: { monthly_goal: number | null; onboarding_profile: unknown; current_saas_id: string | null },
): Promise<AdminMemberJourney> {
  const [saas, batches] = await Promise.all([
    db.from("saas").select("id, name, logo_url, created_at").eq("user_id", userId).order("created_at"),
    db.from("saas_idea_batches").select("revealed").eq("user_id", userId).eq("status", "succeeded"),
  ]);
  const ideaBatches = unwrap(batches, "idea batches") as { revealed: number }[];
  const answers = onboardingProfileSchema.safeParse(profile.onboarding_profile);

  return {
    monthlyGoal: typeof profile.monthly_goal === "number" ? profile.monthly_goal : null,
    onboarding: answers.success && answers.data.length ? answers.data : null,
    ideas: { requests: ideaBatches.length, shown: sum(ideaBatches.map((batch) => batch.revealed)) },
    saas: (unwrap(saas, "saas") as { id: string; name: string; logo_url: string | null; created_at: string }[]).map((row) => ({
      id: row.id,
      name: row.name,
      logoUrl: row.logo_url,
      createdAt: row.created_at,
    })),
    currentSaasId: profile.current_saas_id,
  };
}

type ConnectionRow = {
  id: string;
  provider: RevenueProvider;
  account_name: string | null;
  livemode: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  snapshot: RevenueSnapshot | null;
};

/** A discussion with Gus, with the number of its messages (counted by the embedded resource). */
const DISCUSSION_COLUMNS = "id, saas_id, title, created_at, updated_at, messages:coach_messages(count)";

type DiscussionRow = {
  id: string;
  saas_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: { count: number }[];
};

const discussionOf = (row: DiscussionRow) => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  messages: row.messages[0]?.count ?? 0,
});

/** One SaaS of the member: its roadmap as they see it (checked, not saved), its figures and their use of the app. */
export async function readSaasDetail(db: SupabaseClient, userId: string, saasId: string): Promise<AdminSaasDetail> {
  const roadmap = new RoadmapService(db);
  const saas = await roadmap.ownSaas(userId, saasId);
  const monthAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [state, connections, accounts, videos, recentVideos, carousels, discussions] = await Promise.all([
    roadmap.state(userId, saasId, { save: false }),
    db
      .from("revenue_connections")
      .select("id, provider, account_name, livemode, last_synced_at, last_error, snapshot")
      .eq("saas_id", saasId)
      .eq("user_id", userId),
    db
      .from("tiktok_accounts")
      .select("handle, followers, is_private, sync_error")
      .eq("saas_id", saasId)
      .eq("user_id", userId)
      .order("followers", { ascending: false }),
    db
      .from("tiktok_videos")
      .select("posted_at", { count: "exact" })
      .eq("saas_id", saasId)
      .eq("user_id", userId)
      .order("posted_at", { ascending: false })
      .limit(1),
    db.from("tiktok_videos").select("views").eq("saas_id", saasId).eq("user_id", userId).gte("posted_at", monthAgo),
    db.from("carousels").select("id", { count: "exact", head: true }).eq("saas_id", saasId).eq("user_id", userId).eq("status", "ready"),
    db
      .from("coach_conversations")
      .select(DISCUSSION_COLUMNS, { count: "exact" })
      .eq("saas_id", saasId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(ADMIN_DISCUSSIONS_LISTED),
  ]);

  const connectionRows = unwrap(connections, "revenue connections") as ConnectionRow[];
  const live = connectionRows.filter((row) => row.livemode && row.snapshot);
  const overview = live.length
    ? buildOverview(
        live.map((row) => ({ connectionId: row.id, provider: row.provider, label: row.account_name ?? row.provider, snapshot: row.snapshot! })),
        await getExchangeRates(),
      )
    : null;
  const connection = connectionRows[0] ?? null;

  const latestVideo = unwrap(videos, "videos") as { posted_at: string }[];
  const recent = unwrap(recentVideos, "recent videos") as { views: number }[];
  const discussionRows = unwrap(discussions, "discussions") as DiscussionRow[];
  unwrap(carousels, "carousels");
  const idea = projectOf(saas);

  return {
    id: saas.id,
    name: saas.name,
    logoUrl: saas.logo_url,
    createdAt: saas.created_at,
    description: saas.description,
    audience: saas.audience,
    appUrl: saas.app_url,
    idea: saas.idea ? { problem: idea.problem, price: idea.price } : null,
    roadmap: state,
    payment: connection && {
      provider: connection.provider,
      accountName: connection.account_name,
      livemode: connection.livemode,
      lastSyncedAt: connection.last_synced_at,
      lastError: connection.last_error,
    },
    revenue: overview && {
      currency: overview.currency,
      mrr: overview.mrr.at(-1) ?? 0,
      revenue30d: sum(overview.revenue.slice(-30)),
      subscribers: overview.subscribers.at(-1) ?? 0,
    },
    tiktok: {
      accounts: (unwrap(accounts, "tiktok accounts") as { handle: string; followers: number; is_private: boolean; sync_error: string | null }[]).map(
        (account) => ({ handle: account.handle, followers: account.followers, isPrivate: account.is_private, syncError: account.sync_error }),
      ),
      videos: videos.count ?? latestVideo.length,
      videos30d: recent.length,
      views30d: sum(recent.map((video) => video.views)),
      lastPostAt: latestVideo[0]?.posted_at ?? null,
    },
    carousels: carousels.count ?? 0,
    discussions: { total: discussions.count ?? discussionRows.length, latest: discussionRows.map(discussionOf) },
  };
}

/** Messages read for one discussion: far more than any real one has. */
const DISCUSSION_MESSAGES_MAX = 1_000;

/** A discussion of the member with Gus, and its messages. */
export async function readDiscussion(db: SupabaseClient, userId: string, conversationId: string): Promise<AdminDiscussion> {
  const [conversation, messages] = await Promise.all([
    db.from("coach_conversations").select(DISCUSSION_COLUMNS).eq("id", conversationId).eq("user_id", userId).maybeSingle(),
    db
      .from("coach_messages")
      .select(COACH_MESSAGE_COLUMNS)
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(DISCUSSION_MESSAGES_MAX),
  ]);
  const row = unwrap(conversation, "discussion") as DiscussionRow | null;
  if (!row) throw new HttpError(404, "Discussion introuvable.");
  return { ...discussionOf(row), saasId: row.saas_id, thread: unwrap(messages, "discussion messages") as CoachMessage[] };
}
