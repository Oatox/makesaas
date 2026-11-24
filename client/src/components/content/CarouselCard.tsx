import { useState } from "react";
import { AlertTriangle, Download, Eye, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { parseCarouselDocument } from "@shared/carousel";
import type { Carousel } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDeleteCarousel, useDownloadCarousel } from "@/hooks/use-carousels";
import { formatAgoShort, formatDateTime } from "@/lib/format";
import { GeneratingPreview } from "./GeneratingPreview";
import { ScaledSlide } from "./SlideView";

/**
 * A carousel of the library: preview of its first slide, status, and its actions (`onOpen`: the
 * editor, `onPreview`: the preview dialog).
 */
export function CarouselCard({ carousel, onOpen, onPreview }: { carousel: Carousel; onOpen: () => void; onPreview: () => void }) {
  const remove = useDeleteCarousel();
  const download = useDownloadCarousel();
  const [confirming, setConfirming] = useState(false);
  const document = parseCarouselDocument(carousel.document);
  const isReady = carousel.status === "ready" && !!document;

  return (
    <article className="group space-y-3">
      <button
        type="button"
        disabled={!isReady}
        onClick={onOpen}
        className="relative block w-full overflow-hidden rounded-[14px] border border-border bg-secondary text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 enabled:hover:border-primary/40 disabled:cursor-default"
        aria-label={`Ouvrir ${carousel.title}`}
      >
        {document ? (
          // Every card in 9:16, whatever the carousel's format: a shorter slide (4:5, 1:1) sits in the
          // middle, between black bars.
          <div className="flex aspect-[9/16] flex-col justify-center bg-black">
            <ScaledSlide slide={document.slides[0]} ratio={document.ratio} className="w-full" />
          </div>
        ) : (
          <div className="aspect-[9/16]" />
        )}
        {document && document.slides.length > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
            {document.slides.length} slides
          </span>
        )}
        {carousel.status === "generating" && <GeneratingPreview startedAt={carousel.updated_at} />}
        {carousel.status === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 p-4 text-center text-sm text-white">
            <AlertTriangle className="size-6 text-destructive" />
            {carousel.error ?? "La génération a échoué."}
          </div>
        )}
      </button>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={carousel.title}>
            {carousel.title}
          </p>
          <p className="text-xs text-muted-foreground" title={`Modifié ${formatDateTime(carousel.updated_at).toLowerCase()}`}>
            {formatAgoShort(carousel.updated_at)}
          </p>
          {carousel.status === "ready" && carousel.error && (
            <p className="mt-1 flex items-start gap-1 text-xs text-amber-400">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              {carousel.error}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Actions de ${carousel.title}`}>
              {download.isPending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isReady && (
              <DropdownMenuItem onClick={onPreview}>
                <Eye /> Aperçu
              </DropdownMenuItem>
            )}
            {isReady && (
              <DropdownMenuItem onClick={onOpen}>
                <Pencil /> Modifier
              </DropdownMenuItem>
            )}
            {isReady && (
              <DropdownMenuItem disabled={download.isPending} onClick={() => download.mutate({ title: carousel.title, document })}>
                <Download /> Télécharger
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              disabled={carousel.status === "generating"}
              onClick={() => setConfirming(true)}
            >
              <Trash2 /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {carousel.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>Le carrousel et ses images seront définitivement supprimés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate(carousel)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
