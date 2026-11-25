import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Film } from "lucide-react";
import type { TikTokAccount, TikTokVideo } from "@shared/schema";
import { Button } from "@/components/ui/button";
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

/** Rows per page: only these are rendered (and their covers loaded). */
const PAGE_SIZE = 10;

/** Up to three page numbers around the current one, as in the admin's member list. */
function pageNumbers(page: number, pageCount: number): number[] {
  if (pageCount <= 3) return Array.from({ length: pageCount }, (_, index) => index + 1);
  if (page === 1) return [1, 2, 3];
  if (page === pageCount) return [pageCount - 2, pageCount - 1, pageCount];
  return [page - 1, page, page + 1];
}

const pagerButton = "min-h-11 gap-1 px-3 text-muted-foreground hover:text-foreground disabled:opacity-40 md:min-h-8 md:px-2";

function Pagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Pages des vidéos">
      <p className="hidden text-sm tabular-nums text-muted-foreground sm:block">
        {first}–{last} sur {total}
      </p>
      <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
        <Button variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} className={pagerButton}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Précédent
        </Button>
        {/* Phones: the range instead of the numbers. */}
        <span className="text-sm tabular-nums text-muted-foreground sm:hidden">
          {first}–{last} sur {total}
        </span>
        {pageNumbers(page, pageCount).map((number) => (
          <Button
            key={number}
            variant="ghost"
            size="sm"
            onClick={() => onChange(number)}
            aria-current={number === page ? "page" : undefined}
            className={cn(
              "hidden h-8 w-8 rounded-md px-0 tabular-nums sm:inline-flex",
              number === page ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {number}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={page >= pageCount} className={pagerButton}>
          Suivant
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

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

/** Table of the videos, 10 by 10; each row opens the video on TikTok. */
export function VideoList({
  videos,
  accountsById,
}: {
  videos: TikTokVideo[];
  /** Set when several accounts are shown: each row names its account. */
  accountsById?: Map<string, TikTokAccount>;
}) {
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => [...videos].sort(SORTERS[sort]), [videos, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Fewer videos after a refresh: never past the last page.
  const current = Math.min(page, pageCount);
  const shown = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <section className="card-3d space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-normal">Vidéos</h2>
          <p className="text-sm text-muted-foreground">
            {videos.length} vidéo{videos.length > 1 ? "s" : ""} suivie{videos.length > 1 ? "s" : ""}, stats de la dernière
            analyse.
          </p>
        </div>
        <SegmentedControl
          options={SORTS}
          value={sort}
          onValueChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          label="Trier les vidéos"
          className="w-full sm:w-auto"
        />
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

      {pageCount > 1 && <Pagination page={current} pageCount={pageCount} total={sorted.length} onChange={setPage} />}
    </section>
  );
}
