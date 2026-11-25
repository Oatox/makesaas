import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TikTokAccount, TikTokAccountStat, TikTokVideo } from "@shared/schema";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatCompact, formatInteger } from "@/lib/format";
import { dailySeries } from "./stats";

type ChartMode = "videos" | "views" | "followers";

const MODES = [
  { value: "videos", label: "Vues par vidéo" },
  { value: "views", label: "Vues cumulées" },
  { value: "followers", label: "Abonnés" },
] as const;

const DESCRIPTIONS: Record<ChartMode, string> = {
  videos: "Vues de tes 20 dernières vidéos, de la plus ancienne à la plus récente.",
  views: "Total des vues de tes vidéos, mesuré une fois par jour.",
  followers: "Nombre d'abonnés, mesuré une fois par jour.",
};

/** Videos shown in the bar chart. */
const RECENT_VIDEOS = 20;

// Recessive axes and grid; the data alone carries the brand color.
const axisTick = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };
const gridStroke = "hsl(var(--line))";
const primary = "hsl(var(--primary))";

function TooltipCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="max-w-[260px] rounded-[10px] border border-border bg-card px-3 py-2 text-xs shadow-xl shadow-black/40">
      <p className="mb-1 line-clamp-2 font-medium text-foreground">{title}</p>
      {lines.map((line) => (
        <p key={line} className="tabular-nums text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

type VideoBar = { id: string; label: string; views: number; likes: number; caption: string; date: string; handle?: string };

function VideosBarChart({ data }: { data: VideoBar[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} minTickGap={16} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatCompact} width={48} />
        <Tooltip
          cursor={{ fill: "hsl(var(--foreground) / 0.05)" }}
          content={({ active, payload }) => {
            const video = active ? (payload?.[0]?.payload as VideoBar | undefined) : undefined;
            if (!video) return null;
            return (
              <TooltipCard
                title={video.caption}
                lines={[
                  [video.handle && `@${video.handle}`, video.date].filter(Boolean).join(" · "),
                  `${formatInteger(video.views)} vues · ${formatInteger(video.likes)} likes`,
                ]}
              />
            );
          }}
        />
        <Bar dataKey="views" name="Vues" fill={primary} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type DayPoint = { day: string; label: string; value: number };

function DailyAreaChart({ data, unit }: { data: DayPoint[]; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} minTickGap={24} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={axisTick}
          tickFormatter={formatCompact}
          width={48}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: "hsl(var(--muted-foreground) / 0.4)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            const point = active ? (payload?.[0]?.payload as DayPoint | undefined) : undefined;
            if (!point) return null;
            return (
              <TooltipCard
                title={format(parseISO(point.day), "EEEE d MMMM", { locale: fr })}
                lines={[`${formatInteger(point.value)} ${unit}`]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={primary}
          strokeWidth={2}
          fill={primary}
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 4, fill: primary, stroke: "hsl(var(--card))", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Views per recent video, or the daily evolution of the total views / followers. */
export function AcquisitionChart({
  videos,
  stats,
  accountsById,
}: {
  videos: TikTokVideo[];
  stats: TikTokAccountStat[];
  /** Set when several accounts are shown: the tooltip names the account of each video. */
  accountsById?: Map<string, TikTokAccount>;
}) {
  const [mode, setMode] = useState<ChartMode>("videos");

  const videoBars = useMemo<VideoBar[]>(
    () =>
      videos
        .slice(0, RECENT_VIDEOS)
        .reverse()
        .map((video) => ({
          id: video.video_id,
          label: format(new Date(video.posted_at), "d MMM", { locale: fr }),
          views: video.views,
          likes: video.likes,
          caption: video.caption || "Vidéo sans description",
          date: format(new Date(video.posted_at), "d MMMM yyyy", { locale: fr }),
          handle: accountsById?.get(video.account_id)?.handle,
        })),
    [videos, accountsById],
  );

  const daily = useMemo<DayPoint[]>(() => {
    if (mode === "videos") return [];
    return dailySeries(stats, mode).map((point) => ({
      ...point,
      label: format(parseISO(point.day), "d MMM", { locale: fr }),
    }));
  }, [stats, mode]);

  const isEmpty = mode === "videos" ? videoBars.length === 0 : daily.length < 2;

  return (
    <section className="card-3d space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-normal">{MODES.find((item) => item.value === mode)!.label}</h2>
          <p className="text-sm text-muted-foreground">{DESCRIPTIONS[mode]}</p>
        </div>
        <SegmentedControl options={MODES} value={mode} onValueChange={setMode} label="Graphique" className="w-full sm:w-auto" />
      </div>

      <div className="h-[260px] w-full sm:h-[300px]">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center rounded-[12px] border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
            {mode === "videos"
              ? "Aucune vidéo publique pour l'instant."
              : "La courbe apparaîtra après au moins deux jours de suivi : les stats sont mesurées une fois par jour quand tu ouvres cette page."}
          </div>
        ) : mode === "videos" ? (
          <VideosBarChart data={videoBars} />
        ) : (
          <DailyAreaChart data={daily} unit={mode === "followers" ? "abonnés" : "vues"} />
        )}
      </div>
    </section>
  );
}
