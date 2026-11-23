import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, Pencil } from "lucide-react";
import { CAROUSEL_RATIOS, parseCarouselDocument, type CarouselDocument } from "@shared/carousel";
import type { Carousel } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDownloadCarousel } from "@/hooks/use-carousels";
import { cn } from "@/lib/utils";
import { ScaledSlide } from "./SlideView";

/** Height left to the rest of the dialog (margins, header, dots, buttons) when sizing the slides. */
const RESERVED_HEIGHT = 290;
const SLIDE_HEIGHT = { min: 220, max: 600 };
/** Share of the strip a slide takes when there are several: the next one peeks out, inviting a swipe. */
const SLIDE_SHARE = 0.84;
const SLIDE_GAP = 12;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useViewportHeight() {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return height;
}

/**
 * The slides side by side, one centred at a time: swiped on phones (scroll snap), arrows, dots and
 * the keyboard's ← → elsewhere; a click on a neighbour brings it to the centre.
 */
function SlideStrip({ document }: { document: CarouselDocument }) {
  const { slides, ratio } = document;
  const stripRef = useRef<HTMLDivElement>(null);
  const [stripWidth, setStripWidth] = useState(0);
  const [current, setCurrent] = useState(0);
  const viewportHeight = useViewportHeight();

  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    // clientWidth, not the content box: that one shrinks with the side padding set below.
    const observer = new ResizeObserver(() => setStripWidth(strip.clientWidth));
    observer.observe(strip);
    return () => observer.disconnect();
  }, []);

  // As tall as the screen allows, and narrow enough for the neighbours to peek out.
  const { base } = CAROUSEL_RATIOS[ratio];
  const maxHeight = Math.min(SLIDE_HEIGHT.max, Math.max(SLIDE_HEIGHT.min, viewportHeight - RESERVED_HEIGHT));
  const slideWidth = Math.floor(Math.min(stripWidth * (slides.length > 1 ? SLIDE_SHARE : 1), (maxHeight * base.width) / base.height));
  const step = slideWidth + SLIDE_GAP;
  const sidePadding = Math.max(0, (stripWidth - slideWidth) / 2);

  const goTo = useCallback(
    (index: number, smooth = true) => {
      const target = Math.max(0, Math.min(slides.length - 1, index));
      stripRef.current?.scrollTo({ left: target * step, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
      setCurrent(target);
    },
    [slides.length, step],
  );

  // A resize changes the slides' width: keep the same one centred.
  const currentRef = useRef(current);
  currentRef.current = current;
  useLayoutEffect(() => {
    if (step > 0) goTo(currentRef.current, false);
  }, [step, goTo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goTo(currentRef.current - 1);
      else if (event.key === "ArrowRight") goTo(currentRef.current + 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo]);

  const arrowClass =
    "absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white shadow-lg backdrop-blur transition-opacity hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-0 sm:flex";

  return (
    // min-w-0: in the dialog's grid, the slides side by side would otherwise widen it.
    <div className="min-w-0 space-y-3">
      {/* Edge to edge of the dialog, so the neighbours peek out up to its borders. */}
      <div className="relative -mx-5 sm:-mx-6">
        <div
          ref={stripRef}
          onScroll={(event) => {
            if (step > 0) setCurrent(Math.max(0, Math.min(slides.length - 1, Math.round(event.currentTarget.scrollLeft / step))));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ gap: SLIDE_GAP, paddingInline: sidePadding }}
          aria-roledescription="carrousel"
        >
          {slideWidth > 0 &&
            slides.map((slide, index) => (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${index + 1} sur ${slides.length}`}
                onClick={() => index !== current && goTo(index)}
                className={cn(
                  "shrink-0 snap-center transition-opacity duration-300 [scroll-snap-stop:always]",
                  index !== current && "cursor-pointer opacity-45",
                )}
                style={{ width: slideWidth }}
              >
                <ScaledSlide slide={slide} ratio={ratio} className="rounded-[14px] border border-white/[0.06] shadow-xl shadow-black/40" />
              </div>
            ))}
        </div>

        {slides.length > 1 && (
          <>
            <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0} aria-label="Slide précédente" className={cn(arrowClass, "left-3")}>
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={current === slides.length - 1}
              aria-label="Slide suivante"
              className={cn(arrowClass, "right-3")}
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Aller à la slide ${index + 1}`}
              aria-current={index === current}
              // A small dot, in a hit area big enough for a finger.
              className="group flex h-4 items-center focus-visible:outline-none"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all duration-300 group-focus-visible:ring-2 group-focus-visible:ring-primary/50",
                  index === current ? "w-4 bg-primary" : "w-1.5 bg-white/25 group-hover:bg-white/45",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A ready carousel at a glance, without the editor: its slides one by one (swiped on phones), then
 * "Modifier" (the editor) and "Télécharger" (PNG, or a zip of PNGs). Opens on its own when a
 * generation ends (ContentSection), and from the "Aperçu" item of a card.
 */
export function CarouselPreviewDialog({
  carousel,
  onOpenChange,
  onEdit,
}: {
  carousel: Carousel | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (carousel: Carousel) => void;
}) {
  const download = useDownloadCarousel();
  // The last carousel shown stays rendered while the dialog fades out.
  const lastCarousel = useRef(carousel);
  if (carousel) lastCarousel.current = carousel;
  const shown = carousel ?? lastCarousel.current;
  const document = shown ? parseCarouselDocument(shown.document) : null;
  const slideCount = document?.slides.length ?? 0;

  return (
    <Dialog open={!!carousel && !!document} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {shown && document && (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle className="truncate" title={shown.title}>
                {shown.title}
              </DialogTitle>
              <DialogDescription>
                {slideCount} slide{slideCount > 1 ? "s" : ""} · format {CAROUSEL_RATIOS[document.ratio].label}
              </DialogDescription>
              {shown.error && (
                <p className="flex items-start gap-1.5 pt-1 text-xs text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {shown.error}
                </p>
              )}
            </DialogHeader>

            <SlideStrip key={shown.id} document={document} />

            {/* Side by side, even on phones: the download is the main action. */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button variant="outline" onClick={() => onEdit(shown)} data-testid="button-preview-edit">
                <Pencil /> Modifier
              </Button>
              <Button
                onClick={() => download.mutate({ title: shown.title, document })}
                disabled={download.isPending}
                data-testid="button-preview-download"
              >
                {download.isPending ? <Loader2 className="animate-spin" /> : <Download />}
                Télécharger
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
