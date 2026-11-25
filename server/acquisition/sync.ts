import type { SupabaseClient } from "@supabase/supabase-js";
import { tiktokSyncDay } from "@shared/acquisition";
import type { TikTokAccount } from "@shared/schema";
import type { ScrapeCreatorsClient, TikTokProfile } from "./scrapecreators";

/**
 * Video pages fetched per refresh, newest first (1 ScrapeCreators credit each). Older videos keep the
 * stats of the last refresh that returned them.
 */
const VIDEO_PAGES_PER_SYNC = 3;

type SyncTarget = Pick<TikTokAccount, "id" | "user_id" | "saas_id" | "handle" | "tiktok_user_id">;

/**
 * Fetches the profile (unless the caller already has it) and the latest videos of an account, then
 * saves them with the day's snapshot. Throws ScrapeCreatorsError / TikTokAccountNotFoundError from
 * the provider, or the Supabase error.
 */
export async function syncTikTokAccount(
  db: SupabaseClient,
  scraper: ScrapeCreatorsClient,
  account: SyncTarget,
  knownProfile?: TikTokProfile,
): Promise<TikTokAccount> {
  const profile = knownProfile ?? (await scraper.getProfile(account.handle));
  // A private account shows its counters, never its videos.
  const videos = profile.isPrivate
    ? []
    : await scraper.getLatestVideos(account.handle, profile.tiktokUserId, VIDEO_PAGES_PER_SYNC);
  const now = new Date();

  if (videos.length > 0) {
    const { error } = await db.from("tiktok_videos").upsert(
      videos.map((video) => ({
        account_id: account.id,
        user_id: account.user_id,
        saas_id: account.saas_id,
        video_id: video.videoId,
        caption: video.caption,
        cover_url: video.coverUrl,
        url: video.url,
        duration_seconds: video.durationSeconds,
        posted_at: video.postedAt,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        shares: video.shares,
        saves: video.saves,
        updated_at: now.toISOString(),
      })),
      { onConflict: "account_id,video_id" },
    );
    if (error) throw error;
  }

  // Views of every known video of the account, including older ones out of this refresh.
  const { data: allViews, error: viewsError } = await db.from("tiktok_videos").select("views").eq("account_id", account.id);
  if (viewsError) throw viewsError;
  const totalViews = (allViews ?? []).reduce((sum, row) => sum + Number(row.views ?? 0), 0);

  const { error: statsError } = await db.from("tiktok_account_stats").upsert(
    {
      account_id: account.id,
      user_id: account.user_id,
      saas_id: account.saas_id,
      day: tiktokSyncDay(now),
      followers: profile.followers,
      likes: profile.likes,
      views: totalViews,
      video_count: profile.videoCount,
    },
    { onConflict: "account_id,day" },
  );
  if (statsError) throw statsError;

  const { data: updated, error: updateError } = await db
    .from("tiktok_accounts")
    .update({
      tiktok_user_id: profile.tiktokUserId,
      nickname: profile.nickname,
      avatar_url: profile.avatarUrl,
      verified: profile.verified,
      is_private: profile.isPrivate,
      followers: profile.followers,
      following: profile.following,
      likes: profile.likes,
      video_count: profile.videoCount,
      synced_at: now.toISOString(),
      sync_error: null,
    })
    .eq("id", account.id)
    .select()
    .single();
  if (updateError) throw updateError;
  return updated as TikTokAccount;
}
