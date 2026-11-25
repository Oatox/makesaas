import {
  CAROUSEL_DOCUMENT_VERSION,
  CAROUSEL_RATIOS,
  carouselTextStyleFields,
  createSlide,
  createTextLayer,
  type CarouselDocument,
  type CarouselRatio,
  type CarouselTextStyle,
} from "@shared/carousel";
import type { CarouselAiResult } from "@shared/ai-pipeline";

/**
 * Lays the generated text over the images: a cover slide (big hook, centred) then content slides
 * (headline at the top, explanation at the bottom), bold, in the look the member picked
 * (CAROUSEL_TEXT_STYLES: a dark or white box, an outline or a shadow) so it reads on any image.
 * Everything stays editable in the editor.
 */

// Font sizes are tuned for the 9:16 frame (270 x 480 px) and scaled for the other formats.
const REFERENCE_FRAME = { width: 270, height: 480 };

/** Smaller fonts for longer texts, so they fit without overflowing the slide. */
const fontSizeFor = (text: string, [short, medium, long]: [number, number, number]) =>
  text.length <= 30 ? short : text.length <= 60 ? medium : long;

/** Text boxes span this share of the slide width (%). */
const TEXT_WIDTH = 84;

export function buildGeneratedDocument(
  ratio: CarouselRatio,
  slides: CarouselAiResult["slides"],
  imageUrls: (string | null)[],
  textStyle: CarouselTextStyle,
): CarouselDocument {
  const { base } = CAROUSEL_RATIOS[ratio];
  const scale = Math.min(base.width / REFERENCE_FRAME.width, base.height / REFERENCE_FRAME.height);
  const size = (value: number) => Math.round(value * scale);

  return {
    version: CAROUSEL_DOCUMENT_VERSION,
    ratio,
    slides: slides.map((content, index) => {
      const slide = createSlide("single");
      slide.images[0].url = imageUrls[index] ?? null;
      const isCover = index === 0;

      const headlineSize = size(fontSizeFor(content.headline, isCover ? [30, 25, 21] : [24, 20, 17]));
      slide.textLayers.push(
        createTextLayer({
          ...carouselTextStyleFields(textStyle, headlineSize),
          width: TEXT_WIDTH,
          text: content.headline,
          y: isCover ? 44 : 20,
          fontSize: headlineSize,
          fontWeight: 800,
        }),
      );
      if (content.body) {
        const bodySize = size(content.body.length <= 100 ? 15 : content.body.length <= 160 ? 13 : 12);
        slide.textLayers.push(
          createTextLayer({
            ...carouselTextStyleFields(textStyle, bodySize),
            width: TEXT_WIDTH,
            text: content.body,
            y: isCover ? 64 : 72,
            fontSize: bodySize,
            fontWeight: 600,
          }),
        );
      }
      return slide;
    }),
  };
}
