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

/** Minimum delay between two refreshes of the same account (manual or automatic). */
export const TIKTOK_SYNC_COOLDOWN_MINUTES = 30;

/** Opening the page refreshes by itself the accounts whose stats are older than this. */
export const TIKTOK_AUTO_SYNC_HOURS = 12;

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

export const acquisitionApi = {
  /** POST AddTikTokAccountRequest: adds a TikTok account, then fetches its profile and latest videos. */
  accounts: { path: "/api/acquisition/tiktok/accounts" },
  /** POST: refreshes an account (at most once every TIKTOK_SYNC_COOLDOWN_MINUTES). */
  sync: {
    route: "/api/acquisition/tiktok/accounts/:id/sync",
    path: (id: string) => `/api/acquisition/tiktok/accounts/${encodeURIComponent(id)}/sync`,
  },
};
