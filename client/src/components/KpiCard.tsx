import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, YAxis } from "recharts";
import { blurIn } from "@/lib/motion";

const fadeIn = blurIn({ blur: 8, duration: 0.6 });

type SparklineProps = {
  values: number[];
  color: string;
  kind: "area" | "bar";
  /**
   * `zero` (default): from zero, so an empty period stays flat on the floor of the card (flows,
   * counts). `range`: fitted to the values, so a running total that moves little still shows its
   * moves (followers, likes); a single value is drawn as a flat line.
   */
  fit?: "zero" | "range";
};

type Domain = [number | ((min: number) => number), number | ((max: number) => number)];

function rangeDomain(values: number[]): Domain {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || Math.abs(max) * 0.05 || 1;
  return [min - pad, max + pad];
}

/**
 * Mini chart along the bottom of a card, without axes: an area for flows and running totals, bars
 * for the rest.
 */
export function Sparkline({ values, color, kind, fit = "zero" }: SparklineProps) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  // An area needs two points to draw a line: a single measure is held across the card.
  const points = kind === "area" && values.length === 1 ? [values[0], values[0]] : values;
  const data = points.map((value, index) => ({ index, value }));
  const domain: Domain = fit === "range" && points.length > 0 ? rangeDomain(points) : [0, (max) => Math.max(max, 1)];

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
  /** Exact figure on hover, when `value` is rounded. */
  valueTitle?: string;
  change?: ReactNode;
  chart: ReactNode;
};

/** A key figure, its change, and its mini chart running to the card's edges (Tableau de bord, Statistiques). */
export function KpiCard({ label, action, value, valueTitle, change, chart }: KpiCardProps) {
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
          <p className="text-[28px] font-semibold leading-tight tracking-tight tabular-nums xl:text-[26px] 2xl:text-[32px]" title={valueTitle}>
            {value}
          </p>
          {change}
        </div>
      </div>
      <div aria-hidden className="mt-auto h-14 sm:h-16">
        {chart}
      </div>
    </motion.div>
  );
}
