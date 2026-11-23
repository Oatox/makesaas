import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  CAROUSEL_FONT_STACK,
  CAROUSEL_RATIOS,
  CAROUSEL_TEXT,
  type CarouselImage,
  type CarouselRatio,
  type CarouselSlide,
  type CarouselTextLayer,
} from "@shared/carousel";
import { layoutCells, textShadowLayers } from "@shared/carousel-renderer";
import { cn } from "@/lib/utils";

/**
 * DOM rendering of a slide at its base frame size (e.g. 270 x 480 px for 9:16): previews scale it
 * down, the editor zooms it. It mirrors the Canvas renderer of the export (shared/carousel-renderer.ts):
 * keep both in sync.
 */

/** Box of a text layer: centred on (x, y), auto width up to CAROUSEL_TEXT.maxAutoWidth unless set. */
export function textBoxStyle(layer: CarouselTextLayer): CSSProperties {
  const shadows = textShadowLayers(layer.shadow, layer.shadowIntensity);
  return {
    position: "absolute",
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    transform: "translate(-50%, -50%)",
    boxSizing: "border-box",
    width: layer.width === null ? "max-content" : `${layer.width}%`,
    maxWidth: layer.width === null ? `${CAROUSEL_TEXT.maxAutoWidth}%` : undefined,
    padding: `${CAROUSEL_TEXT.paddingY}px ${CAROUSEL_TEXT.paddingX}px`,
    fontFamily: CAROUSEL_FONT_STACK,
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    fontStyle: layer.italic ? "italic" : "normal",
    lineHeight: CAROUSEL_TEXT.lineHeight,
    textAlign: layer.textAlign,
    textDecorationLine: layer.underline ? "underline" : "none",
    color: layer.color,
    backgroundColor: layer.backgroundColor,
    borderRadius: layer.backgroundRadius,
    textShadow: shadows.length > 0 ? shadows.map((s) => `0 ${s.offsetY}px ${s.blur}px ${s.color}`).join(", ") : undefined,
    whiteSpace: "pre-wrap",
    // Like the canvas: a word wider than the box is broken.
    overflowWrap: "anywhere",
  };
}

/** The text, with its outline drawn by a stroked copy stacked behind it. */
export function TextLayerContent({ layer, text = layer.text }: { layer: CarouselTextLayer; text?: string }) {
  return (
    <span style={{ display: "grid" }}>
      {layer.outlineWidth > 0 && (
        <span
          aria-hidden
          style={{
            gridArea: "1 / 1",
            color: "transparent",
            WebkitTextStroke: `${layer.outlineWidth * 2}px ${layer.outlineColor}`,
          }}
        >
          {text}
        </span>
      )}
      <span style={{ gridArea: "1 / 1" }}>{text}</span>
    </span>
  );
}

export function cellImageStyle(image: CarouselImage): CSSProperties {
  return { objectFit: "cover", objectPosition: `${image.focalX}% ${image.focalY}%` };
}

/** Cells of the slide's layout at its base size (1 px gaps showing the background). */
export function slideCells(slide: Pick<CarouselSlide, "layout">, ratio: CarouselRatio) {
  return layoutCells(slide, CAROUSEL_RATIOS[ratio].base, 1);
}

/** Read-only slide, at its base size. */
export function SlideView({ slide, ratio }: { slide: CarouselSlide; ratio: CarouselRatio }) {
  const { base } = CAROUSEL_RATIOS[ratio];
  return (
    <div className="relative overflow-hidden" style={{ width: base.width, height: base.height, background: slide.background }}>
      {slideCells(slide, ratio).map((cell, index) => {
        const image = slide.images[index];
        if (!image?.url) return null;
        return (
          <img
            key={image.id}
            src={image.url}
            alt=""
            draggable={false}
            loading="lazy"
            className="absolute"
            style={{ left: cell.x, top: cell.y, width: cell.width, height: cell.height, ...cellImageStyle(image) }}
          />
        );
      })}
      {slide.textLayers.map((layer) =>
        layer.text.trim() ? (
          <div key={layer.id} style={textBoxStyle(layer)}>
            <TextLayerContent layer={layer} />
          </div>
        ) : null,
      )}
    </div>
  );
}

/** A slide scaled to the width of its container (previews). */
export function ScaledSlide({ slide, ratio, className }: { slide: CarouselSlide; ratio: CarouselRatio; className?: string }) {
  const { base } = CAROUSEL_RATIOS[ratio];
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / base.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [base.width]);

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      style={{ aspectRatio: `${base.width} / ${base.height}`, background: slide.background }}
    >
      {scale > 0 && (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
          <SlideView slide={slide} ratio={ratio} />
        </div>
      )}
    </div>
  );
}
