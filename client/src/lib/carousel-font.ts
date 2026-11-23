import { CAROUSEL_FONT_FAMILY, CAROUSEL_FONT_WEIGHTS } from "@shared/carousel";

// The slides' font is only needed by the content pages: it is loaded the first time one of them asks.
const FONT_STYLESHEET = `https://fonts.googleapis.com/css2?family=${CAROUSEL_FONT_FAMILY}:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600;1,700;1,800&display=swap`;

export function ensureCarouselFont() {
  if (typeof document === "undefined" || document.querySelector(`link[data-carousel-font]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_STYLESHEET;
  link.dataset.carouselFont = "";
  document.head.appendChild(link);
}

/** Resolves once every weight is ready: a canvas drawn before would use the fallback font. */
export async function loadCarouselFont() {
  ensureCarouselFont();
  await Promise.all(
    CAROUSEL_FONT_WEIGHTS.flatMap((weight) => [
      document.fonts.load(`${weight} 32px "${CAROUSEL_FONT_FAMILY}"`),
      document.fonts.load(`italic ${weight} 32px "${CAROUSEL_FONT_FAMILY}"`),
    ]).map((load) => load.catch(() => [])),
  );
}
