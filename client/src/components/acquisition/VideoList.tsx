import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Film } from "lucide-react";
import type { TikTokAccount, TikTokVideo } from "@shared/schema";
import { ShowMoreButton, useShowMore } from "@/components/ShowMore";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatCompact, formatInteger, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { engagementRate } from "./stats";

type Sort = "recent" | "views" | "engagement";

const SORTS = [
  { value: "recent", label: "Récentes" },
  { value: "views", label: "Plus vues" },
  { value: "engagement", label: "Engagement" },
] as const;

const SORTERS: Record<Sort, (a: TikTokVideo, b: TikTokVideo) => number> = {
  recent: (a, b) => b.posted_at.localeCompare(a.posted_at),
  views: (a, b) => b.views - a.views,
  engagement: (a, b) => (engagementRate(b) ?? -1) - (engagementRate(a) ?? -1),
};

const PAGE_SIZE = 10;

/** Cover of a video; signed TikTok links expire after a few days, hence the fallback. */
function Cover({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-secondary">
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Film className="size-5 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

const numberCell = "px-3 py-3 text-right tabular-nums";
const headCell = "px-3 pb-2 text-right text-xs font-medium text-muted-foreground";

/** Table of the videos, each row opens the video on TikTok. */
export function VideoList({
  videos,
  accountsById,
}: {
  videos: TikTokVideo[];
  /** Set when several accounts are shown: each row names its account. */
  accountsById?: Map<string, TikTokAccount>;
}) {
  const [sort, setSort] = useState<Sort>("recent");
  const sorted = useMemo(() => [...videos].sort(SORTERS[sort]), [videos, sort]);
  const { shown, hasMore, expanded, toggle } = useShowMore(sorted, PAGE_SIZE);

  return (
    <section className="card-3d space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-normal">Vidéos</h2>
          <p className="text-sm text-muted-foreground">
            {videos.length} vidéo{videos.length > 1 ? "s" : ""} suivie{videos.length > 1 ? "s" : ""}, stats à la dernière
            actualisation.
          </p>
        </div>
        <SegmentedControl options={SORTS} value={sort} onValueChange={setSort} label="Trier les vidéos" className="w-full sm:w-auto" />
      </div>

      {videos.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Aucune vidéo publique pour l'instant.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 pb-2 text-left text-xs font-medium text-muted-foreground sm:px-5">Vidéo</th>
                <th className={headCell}>Vues</th>
                <th className={headCell}>Likes</th>
                <th className={cn(headCell, "hidden md:table-cell")}>Comm.</th>
                <th className={cn(headCell, "hidden md:table-cell")}>Partages</th>
                <th className={cn(headCell, "hidden sm:table-cell sm:pr-5")}>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((video) => {
                const rate = engagementRate(video);
                const handle = accountsById?.get(video.account_id)?.handle;
                return (
                  <tr
                    key={`${video.account_id}-${video.video_id}`}
                    className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-foreground/[0.03]"
                    onClick={() => window.open(video.url, "_blank", "noopener,noreferrer")}
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <Cover url={video.cover_url} />
                        <div className="min-w-0 space-y-1">
                          <p className="line-clamp-2 max-w-[38ch] text-foreground group-hover:underline">
                            {video.caption || "Vidéo sans description"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[handle && `@${handle}`, format(new Date(video.posted_at), "d MMM yyyy", { locale: fr })]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </a>
                    </td>
                    <td className={cn(numberCell, "font-medium")} title={formatInteger(video.views)}>
                      {formatCompact(video.views)}
                    </td>
                    <td className={numberCell} title={formatInteger(video.likes)}>
                      {formatCompact(video.likes)}
                    </td>
                    <td className={cn(numberCell, "hidden md:table-cell")}>{formatCompact(video.comments)}</td>
                    <td className={cn(numberCell, "hidden md:table-cell")}>{formatCompact(video.shares)}</td>
                    <td className={cn(numberCell, "hidden text-muted-foreground sm:table-cell sm:pr-5")}>
                      {rate === null ? "—" : formatRate(rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && <ShowMoreButton expanded={expanded} total={sorted.length} noun="vidéos" onToggle={toggle} />}
    </section>
  );
}
