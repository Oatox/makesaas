import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { TikTokAccountStat } from "@shared/schema";
import { formatCompact, formatInteger, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailySeries, periodChange, type DailyMetric, type Totals } from "./stats";

/** Period of the change shown under each counter. */
const CHANGE_DAYS = 7;

function Change({ stats, metric }: { stats: TikTokAccountStat[]; metric: DailyMetric }) {
  const change = periodChange(dailySeries(stats, metric), CHANGE_DAYS);
  if (!change) return <p className="text-xs text-muted-foreground">Évolution visible dès demain</p>;

  const period = change.fullPeriod
    ? `sur ${CHANGE_DAYS} jours`
    : `depuis le ${format(parseISO(change.since), "d MMM", { locale: fr })}`;
  const Icon = change.value < 0 ? TrendingDown : TrendingUp;
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      {change.value !== 0 && (
        <Icon className={cn("size-3.5", change.value > 0 ? "text-success" : "text-destructive")} aria-hidden />
      )}
      <span className="tabular-nums text-foreground/85">
        {change.value > 0 ? "+" : change.value < 0 ? "−" : ""}
        {formatCompact(Math.abs(change.value))}
      </span>
      {period}
    </p>
  );
}

function Tile({ label, value, title, children }: { label: string; value: string; title?: string; children?: React.ReactNode }) {
  return (
    <div className="card-3d space-y-1.5 p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-2xl tabular-nums sm:text-3xl" title={title}>
        {value}
      </p>
      {children}
    </div>
  );
}

/** Headline counters of the selected accounts, with their change over the last days. */
export function StatTiles({ totals, stats }: { totals: Totals; stats: TikTokAccountStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Abonnés" value={formatCompact(totals.followers)} title={formatInteger(totals.followers)}>
        <Change stats={stats} metric="followers" />
      </Tile>
      <Tile label="Vues" value={formatCompact(totals.views)} title={`${formatInteger(totals.views)} vues sur les vidéos suivies`}>
        <Change stats={stats} metric="views" />
      </Tile>
      <Tile label="Likes" value={formatCompact(totals.likes)} title={formatInteger(totals.likes)}>
        <Change stats={stats} metric="likes" />
      </Tile>
      <Tile label="Engagement" value={totals.engagement === null ? "—" : formatRate(totals.engagement)}>
        <p className="text-xs text-muted-foreground">(likes + commentaires + partages) / vues</p>
      </Tile>
    </div>
  );
}
