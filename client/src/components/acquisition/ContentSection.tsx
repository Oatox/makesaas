import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { GalleryHorizontalEnd, Play, Plus } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { EmptyState, ErrorState } from "@/components/StateCard";
import { CarouselCard } from "@/components/content/CarouselCard";
import { CarouselPreviewDialog } from "@/components/content/CarouselPreviewDialog";
import { NewCarouselDialog } from "@/components/content/NewCarouselDialog";
import { NoSaasState } from "@/components/saas/NoSaasState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { carouselKeys, useCarousels, useCreateCarousel } from "@/hooks/use-carousels";
import { useSaas } from "@/hooks/use-saas";
import { ensureCarouselFont } from "@/lib/carousel-font";
import { cn } from "@/lib/utils";

export const carouselEditorPath = (id: string) => `/acquisition/contenu/${id}`;

// As many cards of at least 150 px per row as fit, stretched to fill the row (no gap left on the
// right of a phone): two on a phone, about 150 to 190 px each from four per row on.
const GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))]";

// A TikTok video in the empty state's drawing: a portrait thumbnail, lit from the top left, with its
// view count at the bottom as in a profile grid (`viewsRight`: on the right, the side left uncovered).
function VideoThumb({
  className,
  fill,
  views,
  viewsRight,
  children,
}: {
  className: string;
  fill: string;
  views: string;
  viewsRight?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "absolute overflow-hidden rounded-[9px] border border-white/15 bg-gradient-to-br shadow-[0_12px_24px_-8px_rgb(0_0_0/0.75)]",
        fill,
        className,
      )}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgb(255_255_255/0.35),transparent_60%)]" />
      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />
      {children}
      <span
        className={cn(
          "absolute bottom-1.5 flex items-center gap-0.5 text-[8px] font-semibold leading-none text-white",
          viewsRight ? "right-1.5" : "left-1.5",
        )}
      >
        <Play className="size-2 fill-white" />
        {views}
      </span>
    </span>
  );
}

/** Three TikTok videos overlapping, fanned out: the empty state of the carousels. */
function TikTokStack() {
  return (
    <span aria-hidden className="relative block h-[92px] w-[150px]">
      <VideoThumb className="left-[14px] top-2.5 h-[75px] w-[42px] -rotate-[10deg]" fill="from-violet-400 to-fuchsia-700" views="8K" />
      <VideoThumb className="right-[14px] top-2.5 h-[75px] w-[42px] rotate-[10deg]" fill="from-sky-400 to-indigo-700" views="31K" viewsRight />
      <VideoThumb className="left-[50px] top-0 h-[89px] w-[50px]" fill="from-orange-400 to-orange-600" views="124K">
        <SiTiktok className="absolute right-1.5 top-1.5 size-2.5 text-white/90" />
        <span className="absolute inset-0 m-auto flex size-7 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
          <Play className="ml-0.5 size-3.5 fill-white text-white" />
        </span>
      </VideoThumb>
    </span>
  );
}

function LibrarySkeleton() {
  return (
    <div className={`${GRID_CLASS} gap-4`}>
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="aspect-[9/16] rounded-[14px]" />
      ))}
    </div>
  );
}

/**
 * Carousels seen generating since the app was opened: the first one found ready opens in the preview.
 * Kept outside the page, so a generation that ends while the member is elsewhere opens when they come back.
 */
const awaitingPreview = new Set<string>();

/** The active SaaS's carousels: a new one (generated from a topic, or empty), preview, open, download, delete. */
function CarouselLibrary() {
  const [, navigate] = useLocation();
  const carousels = useCarousels();
  const create = useCreateCarousel();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // A generation that ends in failure gives its slot back: re-read the quota when one ends.
  const generatingCount = carousels.data?.filter((carousel) => carousel.status === "generating").length ?? 0;
  const previousGenerating = useRef(generatingCount);
  useEffect(() => {
    if (generatingCount < previousGenerating.current) queryClient.invalidateQueries({ queryKey: carouselKeys.quota });
    previousGenerating.current = generatingCount;
  }, [generatingCount, queryClient]);

  // A generation that ends opens its carousel in the preview (one at a time, never over the
  // "Nouveau carrousel" dialog: the next one waits for it to close).
  useEffect(() => {
    if (!carousels.data) return;
    for (const carousel of carousels.data) {
      if (carousel.status === "generating") awaitingPreview.add(carousel.id);
      else if (carousel.status === "failed") awaitingPreview.delete(carousel.id);
    }
    if (previewId || dialogOpen) return;
    const finished = carousels.data.find((carousel) => carousel.status === "ready" && awaitingPreview.has(carousel.id));
    if (!finished) return;
    awaitingPreview.delete(finished.id);
    setPreviewId(finished.id);
  }, [carousels.data, previewId, dialogOpen]);

  const action = (
    <Button onClick={() => setDialogOpen(true)} data-testid="button-new-carousel">
      <Plus /> Nouveau carrousel
    </Button>
  );
  const dialog = (
    <NewCarouselDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      onCreateEmpty={() => create.mutate("9:16", { onSuccess: (carousel) => navigate(carouselEditorPath(carousel.id)) })}
      creatingEmpty={create.isPending}
      onStarted={(carousel) => {
        awaitingPreview.add(carousel.id);
        setDialogOpen(false);
      }}
    />
  );
  const preview = (
    <CarouselPreviewDialog
      carousel={carousels.data?.find((carousel) => carousel.id === previewId && carousel.status === "ready") ?? null}
      onOpenChange={(open) => !open && setPreviewId(null)}
      onEdit={(carousel) => navigate(carouselEditorPath(carousel.id))}
    />
  );

  if (carousels.isError) {
    return (
      <ErrorState
        title="Impossible de charger tes carrousels"
        message="Vérifie ta connexion internet puis réessaie."
        action={<Button onClick={() => carousels.refetch()}>Réessayer</Button>}
      />
    );
  }
  if (!carousels.data) return <LibrarySkeleton />;

  if (carousels.data.length === 0) {
    return (
      <>
        <EmptyState
          size="large"
          icon={GalleryHorizontalEnd}
          visual={<TikTokStack />}
          title="Crée tes carrousels TikTok"
          description="Donne un sujet : l'IA écrit chaque slide et crée ses images. Ou pars d'une page blanche."
          action={action}
        />
        {dialog}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-light">Carrousels</h2>
          <p className="text-sm text-muted-foreground">Clique sur un carrousel pour modifier son texte, ses images et sa mise en page.</p>
        </div>
        {action}
      </div>
      <div className={`${GRID_CLASS} gap-x-3 gap-y-6 sm:gap-x-4`}>
        {carousels.data.map((carousel) => (
          <CarouselCard
            key={carousel.id}
            carousel={carousel}
            onOpen={() => navigate(carouselEditorPath(carousel.id))}
            onPreview={() => setPreviewId(carousel.id)}
          />
        ))}
      </div>
      {dialog}
      {preview}
    </div>
  );
}

/** "Création de contenu" part of the acquisition page: the carousels of the active SaaS. */
export function ContentSection() {
  const saas = useSaas();
  useEffect(() => ensureCarouselFont(), []);

  if (saas.isError) {
    return (
      <ErrorState
        title="Impossible de charger tes SaaS"
        message="Vérifie ta connexion internet puis réessaie."
        action={<Button onClick={saas.retry}>Réessayer</Button>}
      />
    );
  }
  if (!saas.currentSaas) {
    return saas.isLoading ? (
      <LibrarySkeleton />
    ) : (
      <NoSaasState description="Les carrousels sont rangés par SaaS. Crée le tien (tu pourras en ajouter d'autres depuis la barre latérale), puis génère ton premier carrousel." />
    );
  }
  return <CarouselLibrary key={saas.currentSaas.id} />;
}
