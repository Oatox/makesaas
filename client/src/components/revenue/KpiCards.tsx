import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { RevenueOverview } from "@shared/revenue";
import { KpiCard, Sparkline } from "@/components/KpiCard";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import {
  bucketPoints,
  formatChange,
  formatCount,
  formatMoney,
  formatRate,
  type PeriodStats,
} from "./stats";

/** One color per figure, the same as in the big chart where they appear there. */
const COLORS = {
  revenue: "hsl(var(--success))",
  mrr: "hsl(var(--primary))",
  newSubscriptions: "hsl(var(--foreground) / 0.75)",
  churn: "hsl(var(--destructive))",
};

type RecurringUnit = "mrr" | "arr";

const RECURRING_UNITS = [
  { value: "mrr", label: "MRR", title: "Revenu mensuel récurrent" },
  { value: "arr", label: "ARR", title: "Revenu annuel récurrent (MRR × 12)" },
] as const;

/** Signed change as a small chip; green when it goes the good way (`upIsGood`), red otherwise. */
function ChangeChip({ ratio, since, upIsGood = true }: { ratio: number | null; since: string; upIsGood?: boolean }) {
  if (ratio === null) return null;
  const good = ratio === 0 ? null : ratio > 0 === upIsGood;
  const Icon = ratio >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      title={`vs ${since}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        good === null ? "bg-secondary text-muted-foreground" : good ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
      )}
    >
      {ratio !== 0 && <Icon className="size-3.5" aria-hidden />}
      {formatChange(ratio)}
      <span className="sr-only"> vs {since}</span>
    </span>
  );
}

type KpiCardsProps = {
  overview: RevenueOverview;
  stats: PeriodStats;
  days: number;
  /** "il y a 30 j": what the level figures (MRR) are compared with. */
  since: string;
};

/** The period's key figures, each with its mini chart over the same buckets as the big chart. */
export function KpiCards({ overview, stats, days, since }: KpiCardsProps) {
  const [unit, setUnit] = useState<RecurringUnit>("mrr");
  const money = (value: number) => formatMoney(value, overview.currency);
  const series = (values: number[], sumValues: boolean) =>
    bucketPoints(overview, values, days, sumValues).map((point) => point.value);

  const multiplier = unit === "arr" ? 12 : 1;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label="Revenu encaissé"
        value={money(stats.revenue)}
        change={<ChangeChip ratio={stats.revenueChange} since="la période d'avant" />}
        chart={<Sparkline values={series(overview.revenue, true)} color={COLORS.revenue} kind="area" />}
      />
      <KpiCard
        label="Revenu récurrent"
        action={
          <SegmentedControl
            options={RECURRING_UNITS}
            value={unit}
            onValueChange={setUnit}
            label="Revenu récurrent mensuel ou annuel"
            className="shrink-0 p-[2px] [&>button]:px-1.5 [&>button]:py-0.5 [&>button]:text-[10px]"
          />
        }
        value={money(stats.mrr * multiplier)}
        change={<ChangeChip ratio={stats.mrrChange} since={since} />}
        chart={<Sparkline values={series(overview.mrr, false).map((value) => value * multiplier)} color={COLORS.mrr} kind="bar" />}
      />
      <KpiCard
        label="Nouveaux abonnés"
        value={formatCount(stats.newSubscriptions)}
        change={<ChangeChip ratio={stats.newSubscriptionsChange} since="la période d'avant" />}
        chart={<Sparkline values={series(overview.newSubscriptions, true)} color={COLORS.newSubscriptions} kind="area" />}
      />
      <KpiCard
        label="Churn"
        value={stats.churnRate === null ? "—" : formatRate(stats.churnRate)}
        chart={<Sparkline values={series(overview.churnedSubscriptions, true)} color={COLORS.churn} kind="bar" />}
      />
    </div>
  );
}
