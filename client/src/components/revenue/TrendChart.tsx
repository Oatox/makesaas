import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";

/** The MRR, the headline: the accent color. */
const MRR_COLOR = "hsl(var(--primary))";
/** Revenue collected, the context behind it: the success green, softened so the MRR line leads. */
const REVENUE_COLOR = "hsl(var(--success) / 0.55)";
const REVENUE_ACTIVE_COLOR = "hsl(var(--success))";
const AXIS_TICK = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };

export type RevenueChartPoint = {
  /** Axis label ("23 nov.", "nov."). */
  label: string;
  /** Tooltip label ("Semaine du 17 nov. au 23 nov."). */
  title: string;
  /** Collected over the bucket. */
  revenue: number;
  /** MRR at the end of the bucket. */
  mrr: number;
};

type RevenueChartProps = {
  points: RevenueChartPoint[];
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  /** "par jour", "par semaine", "par mois": what one bar covers. */
  step: string;
};

/** Key of a series, as drawn: a short bar or a short line. */
function SeriesKey({ kind }: { kind: "bar" | "line" }) {
  return kind === "bar" ? (
    <span aria-hidden className="h-2.5 w-2 rounded-[2px]" style={{ backgroundColor: REVENUE_ACTIVE_COLOR }} />
  ) : (
    <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ backgroundColor: MRR_COLOR }} />
  );
}

/** Whether the MRR gets its own (right) axis: not while it is zero all along. */
export const chartHasMrr = (points: RevenueChartPoint[]) => points.some((point) => point.mrr > 0);

/** Legend of the two series, with the axis each one reads on (once there are two). */
export function RevenueChartLegend({ step, twoAxes }: { step: string; twoAxes: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <SeriesKey kind="line" /> MRR {twoAxes && <span className="opacity-70">(axe de droite)</span>}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <SeriesKey kind="bar" /> Encaissé {step} {twoAxes && <span className="opacity-70">(axe de gauche)</span>}
      </span>
    </div>
  );
}

function ChartTooltip({ active, payload, formatValue }: TooltipProps<number, string> & { formatValue: (value: number) => string }) {
  const point = payload?.[0]?.payload as RevenueChartPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="space-y-1 rounded-[10px] border border-border bg-background/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur">
      <p className="text-xs text-muted-foreground first-letter:uppercase">{point.title}</p>
      <p className="flex items-center gap-2 text-sm">
        <SeriesKey kind="line" />
        <span className="font-semibold text-foreground">{formatValue(point.mrr)}</span>
        <span className="text-xs text-muted-foreground">MRR</span>
      </p>
      <p className="flex items-center gap-2 text-sm">
        <SeriesKey kind="bar" />
        <span className="font-semibold text-foreground">{formatValue(point.revenue)}</span>
        <span className="text-xs text-muted-foreground">encaissé</span>
      </p>
    </div>
  );
}

/**
 * Revenue collected per bucket (bars, left axis) and the MRR at the end of each bucket (line, right
 * axis): a day's revenue is a fraction of a month's MRR, so each reads on its own scale.
 */
export function RevenueChart({ points, formatValue, formatAxis, step }: RevenueChartProps) {
  const hasMrr = chartHasMrr(points);

  return (
    <div className="h-[280px] w-full" role="img" aria-label={`MRR et revenu encaissé ${step}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={28} tickMargin={8} />
          <YAxis
            yAxisId="revenue"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={formatAxis}
            width={56}
            allowDecimals={false}
            domain={[0, "auto"]}
          />
          <YAxis
            yAxisId="mrr"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={formatAxis}
            width={hasMrr ? 56 : 0}
            hide={!hasMrr}
            allowDecimals={false}
            domain={hasMrr ? [0, "auto"] : [0, 1]}
          />
          <Tooltip
            content={<ChartTooltip formatValue={formatValue} />}
            cursor={{ fill: "hsl(var(--foreground) / 0.05)", radius: 6 }}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            name="Encaissé"
            fill={REVENUE_COLOR}
            activeBar={{ fill: REVENUE_ACTIVE_COLOR }}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
          <Line
            yAxisId="mrr"
            type="monotoneX"
            dataKey="mrr"
            name="MRR"
            stroke={MRR_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, fill: MRR_COLOR, stroke: "hsl(var(--card))", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
