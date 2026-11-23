import { useId, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, YAxis } from "recharts";
import type { RevenueOverview } from "@shared/revenue";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { blurIn } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  bucketPoints,
  formatChange,
  formatCount,
  formatMoney,
  formatRate,
  type PeriodStats,
} from "./stats";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

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

/**
 * Mini chart along the bottom of a card, without axes: an area for flows, bars for the rest. Both
 * start at zero, so an empty period stays flat on the floor of the card.
 */
function Sparkline({ values, color, kind }: { values: number[]; color: string; kind: "area" | "bar" }) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const data = values.map((value, index) => ({ index, value }));
  const domain: [number, (max: number) => number] = [0, (max) => Math.max(max, 1)];

  return (
    <ResponsiveContainer width="100%" height="100%">
      {kind === "area" ? (
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={domain} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={false}
            animationDuration={700}
          />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 12 }} barCategoryGap="22%">
          <YAxis hide domain={domain} />
          {/* minPointSize: a zero bucket keeps a dimmed 3 px stub, so an empty period still shows
              its bars on the floor (like the areas' flat line) instead of an empty card. */}
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={16} minPointSize={3} animationDuration={700}>
            {data.map((point) => (
              <Cell key={point.index} fillOpacity={point.value === 0 ? 0.5 : 1} />
            ))}
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

type KpiCardProps = {
  label: string;
  /** At the right of the label (e.g. the MRR / ARR switch). */
  action?: ReactNode;
  value: string;
  change?: ReactNode;
  chart: ReactNode;
};

function KpiCard({ label, action, value, change, chart }: KpiCardProps) {
  return (
    <motion.div variants={fadeIn} className="card-3d flex min-w-0 flex-col overflow-hidden">
      <div className="space-y-2 p-4 pb-2 2xl:p-5 2xl:pb-2">
        <div className="flex min-h-7 items-center justify-between gap-1.5">
          <p className="truncate text-sm text-muted-foreground" title={label}>
            {label}
          </p>
          {action}
        </div>
        {/* Four cards share the row from xl: a notch smaller there, until 2xl gives them room. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[28px] font-semibold leading-tight tracking-tight tabular-nums xl:text-[26px] 2xl:text-[32px]">{value}</p>
          {change}
        </div>
      </div>
      {/* The chart runs to the card's edges. */}
      <div aria-hidden className="mt-auto h-14 sm:h-16">
        {chart}
      </div>
    </motion.div>
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
