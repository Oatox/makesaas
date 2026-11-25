import { useEffect, useMemo } from "react";
import {
  CAROUSEL_TEXT_STYLES,
  CAROUSEL_TEXT_STYLE_IDS,
  carouselTextStyleFields,
  createTextLayer,
  type CarouselTextStyle,
} from "@shared/carousel";
import { ensureCarouselFont } from "@/lib/carousel-font";
import { cn } from "@/lib/utils";
import { TextLayerContent, textBoxStyle } from "./SlideView";

/**
 * A sample of each look: a title as the generation lays it (shared/carousel.ts,
 * carouselTextStyleFields), drawn by the slides' own renderer (SlideView) in a frame of the
 * slides' size, scaled down (more on phones, where the four tiles share one row) over a plain mid
 * grey: light enough for an outline or a shadow to show, which the dark tile would hide.
 */
const SAMPLE = { width: 200, height: 116, fontSize: 24, text: "Ton titre" } as const;
const SAMPLE_BACKGROUND = "hsl(160 4% 46%)";

function TextStyleSample({ style }: { style: CarouselTextStyle }) {
  const layer = useMemo(
    () => createTextLayer({ ...carouselTextStyleFields(style, SAMPLE.fontSize), text: SAMPLE.text, fontSize: SAMPLE.fontSize, fontWeight: 800 }),
    [style],
  );
  return (
    <span
      aria-hidden
      className="relative block h-12 overflow-hidden rounded-[8px] [--sample-scale:0.42] sm:h-16 sm:[--sample-scale:0.55]"
      style={{ background: SAMPLE_BACKGROUND }}
    >
      <span
        className="absolute left-1/2 top-1/2"
        style={{ width: SAMPLE.width, height: SAMPLE.height, transform: "translate(-50%, -50%) scale(var(--sample-scale))" }}
      >
        <span style={textBoxStyle(layer)}>
          <TextLayerContent layer={layer} />
        </span>
      </span>
    </span>
  );
}

/** "Style du texte" of the generation form (NewCarouselDialog): one tile per look, as radios. */
export function TextStylePicker({ value, onChange }: { value: CarouselTextStyle; onChange: (style: CarouselTextStyle) => void }) {
  // The samples use the slides' font, loaded on demand.
  useEffect(() => ensureCarouselFont(), []);

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">Style du texte</legend>
      <div className="grid grid-cols-4 gap-2">
        {CAROUSEL_TEXT_STYLE_IDS.map((id) => {
          const selected = value === id;
          return (
            <label key={id} className="cursor-pointer">
              {/* A real radio (hidden): arrow keys move between the styles. */}
              <input
                type="radio"
                name="carousel-text-style"
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block rounded-[12px] border p-1 transition-colors sm:p-1.5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40",
                  selected ? "border-primary/60 bg-primary/[0.08]" : "border-border bg-background/40 hover:border-white/20 hover:bg-white/[0.03]",
                )}
              >
                <TextStyleSample style={id} />
                <span className={cn("mt-1.5 block truncate text-center text-[11px] font-semibold sm:text-xs", selected ? "text-foreground" : "text-foreground/80")}>
                  {CAROUSEL_TEXT_STYLES[id].label}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
