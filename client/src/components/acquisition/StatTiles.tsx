import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { TikTokAccountStat, TikTokVideo } from "@shared/schema";
import { KpiCard, Sparkline } from "@/components/KpiCard";
import { formatCompact, formatInteger, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailySeries, engagementRate, periodChange, type DailyMetric, type Totals } from "./stats";

/** Period of the change shown by each counter. */
const CHANGE_DAYS = 7;
/** Days drawn by the mini charts of the running totals. */
const SPARK_DAYS = 30;
/** Latest videos drawn by the engagement's mini chart. */
const SPARK_VIDEOS = 12;

/** One color per figure; the followers keep the big chart's color. */
const COLORS = {
  followers: "hsl(var(--primary))",
  views: "hsl(var(--foreground) / 0.75)",
  likes: "hsl(var(--success))",
  engagement: "hsl(var(--chart-4))",
};

/** Change over the last days as a chip, as on the Tableau de bord; none before a second day of data. */
function ChangeChip({ stats, metric }: { stats: TikTokAccountStat[]; metric: DailyMetric }) {
  const change = periodChange(dailySeries(stats, metric), CHANGE_DAYS);
  if (!change) return null;

  const period = change.fullPeriod
    ? `sur ${CHANGE_DAYS} jours`
    : `depuis le ${format(parseISO(change.since), "d MMM", { locale: fr })}`;
  const Icon = change.value < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <span
      title={`${change.value > 0 ? "+" : change.value < 0 ? "−" : ""}${formatInteger(Math.abs(change.value))} ${period}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        change.value === 0
          ? "bg-secondary text-muted-foreground"
          : change.value > 0
            ? "bg-success/15 text-success"
            : "bg-destructive/15 text-destructive",
      )}
    >
      {change.value !== 0 && <Icon className="size-3.5" aria-hidden />}
      {change.value > 0 ? "+" : change.value < 0 ? "−" : ""}
      {formatCompact(Math.abs(change.value))}
      <span className="sr-only"> {period}</span>
    </span>
  );
}

/** A running total day by day, over the last days. */
function TotalSparkline({ stats, metric, color }: { stats: TikTokAccountStat[]; metric: DailyMetric; color: string }) {
  const values = dailySeries(stats, metric)
    .slice(-SPARK_DAYS)
    .map((point) => point.value);
  return <Sparkline values={values} color={color} kind="area" fit="range" />;
}

/** Headline counters of the selected accounts, each with its change and its mini chart. */
export function StatTiles({ totals, stats, videos }: { totals: Totals; stats: TikTokAccountStat[]; videos: TikTokVideo[] }) {
  const latestVideos = [...videos]
    .sort((a, b) => a.posted_at.localeCompare(b.posted_at))
    .slice(-SPARK_VIDEOS);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiCard
        label="Abonnés"
        value={formatCompact(totals.followers)}
        valueTitle={formatInteger(totals.followers)}
        change={<ChangeChip stats={stats} metric="followers" />}
        chart={<TotalSparkline stats={stats} metric="followers" color={COLORS.followers} />}
      />
      <KpiCard
        label="Vues"
        value={formatCompact(totals.views)}
        valueTitle={`${formatInteger(totals.views)} vues sur les vidéos suivies`}
        change={<ChangeChip stats={stats} metric="views" />}
        chart={<TotalSparkline stats={stats} metric="views" color={COLORS.views} />}
      />
      <KpiCard
        label="Likes"
        value={formatCompact(totals.likes)}
        valueTitle={formatInteger(totals.likes)}
        change={<ChangeChip stats={stats} metric="likes" />}
        chart={<TotalSparkline stats={stats} metric="likes" color={COLORS.likes} />}
      />
      <KpiCard
        label="Engagement"
        value={totals.engagement === null ? "—" : formatRate(totals.engagement)}
        valueTitle="(likes + commentaires + partages) / vues"
        chart={
          <Sparkline
            values={latestVideos.map((video) => engagementRate(video) ?? 0)}
            color={COLORS.engagement}
            kind="bar"
          />
        }
      />
    </div>
  );
}
