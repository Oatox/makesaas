import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { CAROUSEL_MAX_SLIDES, CAROUSEL_RATIOS } from "@shared/carousel";
import { trackPointer, useEditor } from "./editor-context";
import { edits, newSlideAfter } from "./editor-state";
import { SlideFrame } from "./SlideFrame";

export type CanvasView = { zoom: number; x: number; y: number };

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2.5;
/** Space between two slides, in base frame px. */
const SLIDE_GAP = 72;
const GRID_SIZE = 24;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/**
 * Dashed links between consecutive frames, at mid-height: the slides read as one carousel, in
 * order. Stroke and dashes keep the same size on screen whatever the zoom.
 */
function SlideConnectors({ count, step, frame, zoom }: { count: number; step: number; frame: { width: number; height: number }; zoom: number }) {
  if (count < 2) return null;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute left-0 overflow-visible"
      style={{ top: frame.height / 2, width: count * step, height: 1 }}
    >
      {Array.from({ length: count - 1 }, (_, index) => (
        <line
          key={index}
          x1={index * step + frame.width}
          x2={(index + 1) * step}
          y1={0}
          y2={0}
          stroke="rgba(148, 163, 184, 0.76)"
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${5 / zoom} ${8 / zoom}`}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/**
 * The workspace: slides side by side on a canvas that pans (drag the background, scroll) and zooms
 * (Ctrl/⌘ + scroll or pinch, the buttons), like a design tool.
 */
export function EditorCanvas({ view, setView }: { view: CanvasView; setView: Dispatch<SetStateAction<CanvasView>> }) {
  const { document, select, edit } = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const { base } = CAROUSEL_RATIOS[document.ratio];
  const step = base.width + SLIDE_GAP;

  /** The first slides fill the height of the screen, with room for the labels and the toolbar. */
  const fit = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    const zoom = clampZoom(Math.min((height - 170) / base.height, (width - 96) / base.width, 1.6));
    setView({ zoom, x: Math.max(48, (width - Math.min(document.slides.length, 3) * step * zoom) / 2), y: (height - base.height * zoom) / 2 - 8 });
    // Refit when the format changes, not on every slide added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.width, base.height, setView, step]);

  useLayoutEffect(fit, [fit]);

  /** Zoom keeping the point under `anchor` (screen px, relative to the canvas) still. */
  const zoomAt = useCallback(
    (nextZoom: number, anchor?: { x: number; y: number }) =>
      setView((current) => {
        const zoom = clampZoom(nextZoom);
        const rect = containerRef.current?.getBoundingClientRect();
        const point = anchor ?? { x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 };
        return {
          zoom,
          x: point.x - ((point.x - current.x) / current.zoom) * zoom,
          y: point.y - ((point.y - current.y) / current.zoom) * zoom,
        };
      }),
    [setView],
  );

  // Wheel: pan, or zoom with Ctrl/⌘ (also what trackpad pinches send). Non-passive to stop page zoom.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = container.getBoundingClientRect();
        setView((current) => {
          const zoom = clampZoom(current.zoom * Math.exp(-event.deltaY * 0.01));
          const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          return { zoom, x: point.x - ((point.x - current.x) / current.zoom) * zoom, y: point.y - ((point.y - current.y) / current.zoom) * zoom };
        });
      } else {
        setView((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [setView]);

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-slide], [data-canvas-control]")) return;
    select(null);
    const start = view;
    trackPointer(event, (_, delta) => setView((current) => ({ ...current, x: start.x + delta.x, y: start.y + delta.y })));
  };

  const lastSlide = document.slides[document.slides.length - 1];
  const canAddSlide = document.slides.length < CAROUSEL_MAX_SLIDES;
  // The slides, plus the "Ajouter une slide" frame that follows them.
  const frameCount = document.slides.length + (canAddSlide ? 1 : 0);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      style={{
        backgroundColor: "#0b0d0c",
        backgroundImage: "radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px)",
        backgroundSize: `${GRID_SIZE * view.zoom}px ${GRID_SIZE * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={startPan}
    >
      <div className="absolute left-0 top-0 origin-top-left cursor-default" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <SlideConnectors count={frameCount} step={step} frame={base} zoom={view.zoom} />
        {document.slides.map((slide, index) => (
          <SlideFrame key={slide.id} slide={slide} index={index} left={index * step} />
        ))}
        {canAddSlide && (
          // Same size as a slide: the next one, ready to be filled.
          <button
            type="button"
            data-slide
            onClick={() => {
              const slide = newSlideAfter(lastSlide);
              edit(edits.addSlide(null, slide));
              select(slide.id);
            }}
            className="absolute top-0 flex flex-col items-center justify-center gap-3 border-dashed border-white/15 text-white/40 transition-colors hover:border-primary/60 hover:bg-primary/[0.03] hover:text-white/80"
            style={{ left: document.slides.length * step, width: base.width, height: base.height, borderWidth: 1.5 / view.zoom }}
          >
            <Plus className="size-8" />
            <span className="text-sm font-medium">Ajouter une slide</span>
          </button>
        )}
      </div>

      <div
        data-canvas-control
        className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-xl border border-white/10 bg-neutral-950/85 p-1 text-white/80 shadow-xl backdrop-blur"
      >
        <button type="button" aria-label="Dézoomer" className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10" onClick={() => zoomAt(view.zoom / 1.2)}>
          <Minus className="size-4" />
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(view.zoom * 100)} %</span>
        <button type="button" aria-label="Zoomer" className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10" onClick={() => zoomAt(view.zoom * 1.2)}>
          <Plus className="size-4" />
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
        <button type="button" aria-label="Ajuster à l'écran" title="Ajuster à l'écran" className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10" onClick={fit}>
          <Maximize className="size-4" />
        </button>
      </div>
    </div>
  );
}
