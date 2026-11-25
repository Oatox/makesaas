/**
 * Acquisition page (/acquisition): the TikTok accounts a subscriber tracks for each of their SaaS,
 * added by their @handle. Their public stats are fetched from ScrapeCreators by the server
 * (server/acquisition/), and every refresh costs credits: hence the limits below.
 */

/**
 * Accounts a user can track at once, all their SaaS together: the cost in credits follows the
 * number of accounts, not the number of SaaS.
 */
export const TIKTOK_MAX_ACCOUNTS = 5;

/**
 * One analysis per account and day, automatic: the first opening of the page on a day refreshes the
 * accounts not refreshed yet that day (failed attempts and the add included), and the server refuses
 * a second one. The day is Paris's, as the key of the daily snapshots (tiktok_account_stats.day).
 */
const SYNC_TIME_ZONE = "Europe/Paris";

/** Calendar day in Paris (YYYY-MM-DD): the key of the daily snapshot, and of the day's analysis. */
export function tiktokSyncDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SYNC_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Whether the account was already refreshed (or tried) today: its analysis of the day is done. */
export function syncedToday(attemptedAt: string | null, now = new Date()): boolean {
  return attemptedAt !== null && tiktokSyncDay(new Date(attemptedAt)) === tiktokSyncDay(now);
}

/**
 * "Vérifier ma vidéo", the button of the first video's task: reads the SaaS's accounts again despite
 * the day's analysis (the member just posted, and the account was added minutes ago), at most once
 * per this delay per account, and only until a first video is seen.
 */
export const TIKTOK_FIRST_VIDEO_CHECK_MINUTES = 2;

// TikTok handles: 2 to 24 letters, digits, underscores and periods.
const HANDLE_PATTERN = /^[a-z0-9_.]{2,24}$/;

/** "@Pseudo", "pseudo" or a tiktok.com/@pseudo link → "pseudo"; null when it is not a valid handle. */
export function normalizeTikTokHandle(input: string): string | null {
  let value = input.trim();
  const fromUrl = value.match(/tiktok\.com\/@([^/?#\s]+)/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/^@/, "").toLowerCase();
  return HANDLE_PATTERN.test(value) ? value : null;
}

/** The SaaS (one of the user's) the account is added to, and its handle as typed. */
export type AddTikTokAccountRequest = { saasId: string; handle: string };

/** The SaaS (one of the user's) whose accounts are read again, to see its first video. */
export type CheckFirstVideoRequest = { saasId: string };

export const acquisitionApi = {
  /** POST AddTikTokAccountRequest: adds a TikTok account, then fetches its profile and latest videos. */
  accounts: { path: "/api/acquisition/tiktok/accounts" },
  /** POST: the day's analysis of an account (sent by the page itself; once a day, see syncedToday). */
  sync: {
    route: "/api/acquisition/tiktok/accounts/:id/sync",
    path: (id: string) => `/api/acquisition/tiktok/accounts/${encodeURIComponent(id)}/sync`,
  },
  /**
   * POST CheckFirstVideoRequest: refreshes now every account of a SaaS without a video yet (at most
   * once every TIKTOK_FIRST_VIDEO_CHECK_MINUTES per account), and answers its accounts (sync_error
   * on those that failed). With a video already seen, answers them as they are.
   */
  firstVideo: { path: "/api/acquisition/tiktok/first-video" },
};
