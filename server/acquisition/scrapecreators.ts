import { z } from "zod";
import { logger } from "../lib/logger";

// Docs: https://docs.scrapecreators.com (TikTok: /v1/tiktok/profile, /v3/tiktok/profile/videos).
// Every successful call costs 1 credit.
const BASE_URL = "https://api.scrapecreators.com";
const REQUEST_TIMEOUT_MS = 30_000;

export class ScrapeCreatorsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ScrapeCreatorsError";
  }
}

/** The handle matches no public TikTok account. */
export class TikTokAccountNotFoundError extends Error {
  constructor(readonly handle: string) {
    super(`TikTok account not found: ${handle}`);
    this.name = "TikTokAccountNotFoundError";
  }
}

export type TikTokProfile = {
  tiktokUserId: string;
  handle: string;
  nickname: string | null;
  avatarUrl: string | null;
  verified: boolean;
  isPrivate: boolean;
  followers: number;
  following: number;
  likes: number;
  videoCount: number;
};

export type TikTokVideoData = {
  videoId: string;
  caption: string | null;
  coverUrl: string | null;
  url: string;
  durationSeconds: number | null;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

// Counters are sometimes missing or sent as strings: anything unreadable counts as 0.
const counter = z.coerce.number().int().nonnegative().catch(0);

const profileResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    uniqueId: z.string(),
    nickname: z.string().nullish(),
    avatarMedium: z.string().nullish(),
    avatarLarger: z.string().nullish(),
    avatarThumb: z.string().nullish(),
    verified: z.boolean().nullish(),
    privateAccount: z.boolean().nullish(),
  }),
  stats: z.object({
    followerCount: counter,
    followingCount: counter,
    heartCount: counter,
    heart: counter,
    videoCount: counter,
  }),
});

const imageSchema = z.object({ url_list: z.array(z.string()).nullish() }).nullish();

const videoItemSchema = z.object({
  aweme_id: z.string(),
  desc: z.string().nullish(),
  create_time: z.number().positive(),
  statistics: z.object({
    play_count: counter,
    digg_count: counter,
    comment_count: counter,
    share_count: counter,
    collect_count: counter,
  }),
  video: z
    .object({
      cover: imageSchema,
      origin_cover: imageSchema,
      dynamic_cover: imageSchema,
      /** Milliseconds. */
      duration: z.number().nullish(),
    })
    .nullish(),
});

const videosPageSchema = z.object({
  aweme_list: z.array(z.unknown()).nullish(),
  has_more: z.union([z.number(), z.boolean()]).nullish(),
  max_cursor: z.union([z.number(), z.string()]).nullish(),
});

/**
 * First usable image of the lists, skipping HEIC files (TikTok often serves covers as .heic,
 * which most browsers cannot display). Cover links are signed and expire after a few days: they
 * are refreshed with the stats.
 */
function pickImageUrl(...lists: (string[] | null | undefined)[]): string | null {
  const urls = lists.flatMap((list) => list ?? []);
  return urls.find((url) => !/\.heic(\?|$)/i.test(url)) ?? null;
}

const isFailure = (payload: unknown) =>
  typeof payload === "object" && payload !== null && (payload as { success?: unknown }).success === false;

/** Minimal ScrapeCreators client: public TikTok profile and videos. */
export class ScrapeCreatorsClient {
  constructor(private readonly apiKey: string) {}

  async getProfile(handle: string): Promise<TikTokProfile> {
    const payload = await this.request("/v1/tiktok/profile", { handle }, handle);
    const parsed = profileResponseSchema.safeParse(payload);
    // An unknown handle answers success: false, or without a user object.
    if (isFailure(payload) || !parsed.success) throw new TikTokAccountNotFoundError(handle);

    const { user, stats } = parsed.data;
    return {
      tiktokUserId: user.id,
      handle: user.uniqueId.toLowerCase(),
      nickname: user.nickname || null,
      avatarUrl: user.avatarMedium || user.avatarLarger || user.avatarThumb || null,
      verified: user.verified ?? false,
      isPrivate: user.privateAccount ?? false,
      followers: stats.followerCount,
      following: stats.followingCount,
      likes: stats.heartCount || stats.heart,
      videoCount: stats.videoCount,
    };
  }

  /** Latest videos of the account, newest first, over at most `maxPages` pages (1 credit each). */
  async getLatestVideos(handle: string, tiktokUserId: string | null, maxPages: number): Promise<TikTokVideoData[]> {
    const videos = new Map<string, TikTokVideoData>();
    let cursor: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      const query: Record<string, string> = { handle, sort_by: "latest" };
      if (tiktokUserId) query.user_id = tiktokUserId;
      if (cursor) query.max_cursor = cursor;

      const payload = await this.request("/v3/tiktok/profile/videos", query, handle);
      const parsed = videosPageSchema.safeParse(payload);
      if (isFailure(payload) || !parsed.success) throw new ScrapeCreatorsError("Unexpected videos response");

      for (const raw of parsed.data.aweme_list ?? []) {
        const item = videoItemSchema.safeParse(raw);
        // Items that are not regular posts (missing id or date) are skipped; pages can repeat items.
        if (!item.success || videos.has(item.data.aweme_id)) continue;

        const { aweme_id, desc, create_time, statistics, video } = item.data;
        videos.set(aweme_id, {
          videoId: aweme_id,
          caption: desc?.trim() || null,
          coverUrl: pickImageUrl(video?.cover?.url_list, video?.origin_cover?.url_list, video?.dynamic_cover?.url_list),
          url: `https://www.tiktok.com/@${handle}/video/${aweme_id}`,
          durationSeconds: video?.duration ? Math.round(video.duration / 1000) : null,
          postedAt: new Date(create_time * 1000).toISOString(),
          views: statistics.play_count,
          likes: statistics.digg_count,
          comments: statistics.comment_count,
          shares: statistics.share_count,
          saves: statistics.collect_count,
        });
      }

      const next = parsed.data.max_cursor;
      if (!parsed.data.has_more || next === null || next === undefined || String(next) === cursor) break;
      cursor = String(next);
    }

    return Array.from(videos.values());
  }

  private async request(path: string, query: Record<string, string>, handle: string): Promise<unknown> {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "x-api-key": this.apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new ScrapeCreatorsError(`ScrapeCreators unreachable: ${(err as Error).message}`);
    }

    const payload = await response.json().catch(() => null);
    if (response.status === 404) throw new TikTokAccountNotFoundError(handle);
    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : response.statusText;
      logger.warn({ status: response.status, path, message }, "ScrapeCreators request failed");
      throw new ScrapeCreatorsError(`ScrapeCreators ${response.status}: ${message}`, response.status);
    }
    return payload;
  }
}
