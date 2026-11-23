import { addDays, format, parseISO, subDays } from "date-fns";
import type { TikTokAccount, TikTokAccountStat, TikTokVideo } from "@shared/schema";

export type Totals = {
  followers: number;
  /** Views of the known videos. */
  views: number;
  /** Likes received by the accounts (all their videos). */
  likes: number;
  videoCount: number;
  /** (likes + comments + shares) / views over the known videos; null without views. */
  engagement: number | null;
};

const interactions = (video: TikTokVideo) => video.likes + video.comments + video.shares;

/** (likes + comments + shares) / views of a video; null when it has no views yet. */
export const engagementRate = (video: TikTokVideo) => (video.views > 0 ? interactions(video) / video.views : null);

export function computeTotals(accounts: TikTokAccount[], videos: TikTokVideo[]): Totals {
  const views = videos.reduce((sum, video) => sum + video.views, 0);
  return {
    followers: accounts.reduce((sum, account) => sum + account.followers, 0),
    views,
    likes: accounts.reduce((sum, account) => sum + account.likes, 0),
    videoCount: accounts.reduce((sum, account) => sum + account.video_count, 0),
    engagement: views > 0 ? videos.reduce((sum, video) => sum + interactions(video), 0) / views : null,
  };
}

export type DailyMetric = "followers" | "views" | "likes";
export type DailyPoint = { day: string; value: number };

/**
 * One point per day, from the first snapshot to the last one, summed over the accounts. An account
 * is only measured on the days it was refreshed: its last value is carried over the days between.
 */
export function dailySeries(stats: TikTokAccountStat[], metric: DailyMetric): DailyPoint[] {
  if (stats.length === 0) return [];

  const byDay = new Map<string, TikTokAccountStat[]>();
  for (const row of stats) byDay.set(row.day, [...(byDay.get(row.day) ?? []), row]);
  const days = Array.from(byDay.keys()).sort();
  const last = days[days.length - 1];

  const current = new Map<string, number>();
  const points: DailyPoint[] = [];
  for (let day = parseISO(days[0]); ; day = addDays(day, 1)) {
    const key = format(day, "yyyy-MM-dd");
    for (const row of byDay.get(key) ?? []) current.set(row.account_id, row[metric]);
    points.push({ day: key, value: Array.from(current.values()).reduce((sum, value) => sum + value, 0) });
    if (key >= last) break;
  }
  return points;
}

/**
 * Change over the last `days` days of a daily series. When tracking started more recently, the
 * change since the first measure (`since` tells which day); null with a single day of data.
 */
export function periodChange(series: DailyPoint[], days: number): { value: number; since: string; fullPeriod: boolean } | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const target = format(subDays(parseISO(last.day), days), "yyyy-MM-dd");
  const baseline = series.find((point) => point.day >= target)!;
  if (baseline === last) return null;
  return { value: last.value - baseline.value, since: baseline.day, fullPeriod: baseline.day === target };
}
