import { z } from "zod";

/**
 * Carousels of the content page (/acquisition/contenu): one JSON document per carousel, stored in
 * public.carousels (supabase_setup.sql, section 12). The editor saves it straight from the browser;
 * the server generates it from a topic (server/content/). The same document is drawn by the DOM
 * (editor, previews) and by the Canvas renderer (shared/carousel-renderer.ts, image export).
 *
 * Coordinates: a text layer is placed by its centre (x, y in % of the slide); its sizes (font size,
 * paddings, outline, radius) are in px of the slide's base frame (CAROUSEL_RATIOS[ratio].base,
 * e.g. 270 px wide for 9:16) and scaled up at export (1080 px wide).
 */

export const CAROUSEL_DOCUMENT_VERSION = 1;

// ---- Formats and layouts ----

export const CAROUSEL_RATIO_IDS = ["9:16", "4:5", "1:1"] as const;
export type CarouselRatio = (typeof CAROUSEL_RATIO_IDS)[number];

type Size = { width: number; height: number };

export const CAROUSEL_RATIOS: Record<CarouselRatio, { label: string; detail: string; base: Size; export: Size }> = {
  "9:16": { label: "9:16", detail: "Vertical", base: { width: 270, height: 480 }, export: { width: 1080, height: 1920 } },
  "4:5": { label: "4:5", detail: "Portrait", base: { width: 336, height: 420 }, export: { width: 1080, height: 1350 } },
  "1:1": { label: "1:1", detail: "Carré", base: { width: 420, height: 420 }, export: { width: 1080, height: 1080 } },
};

export const CAROUSEL_LAYOUT_IDS = ["single", "two-columns", "two-rows", "grid-2x2", "grid-3x3"] as const;
export type CarouselLayout = (typeof CAROUSEL_LAYOUT_IDS)[number];

export const CAROUSEL_LAYOUTS: Record<CarouselLayout, { columns: number; rows: number; label: string }> = {
  single: { columns: 1, rows: 1, label: "Une image" },
  "two-columns": { columns: 2, rows: 1, label: "Deux colonnes" },
  "two-rows": { columns: 1, rows: 2, label: "Deux lignes" },
  "grid-2x2": { columns: 2, rows: 2, label: "Grille 2×2" },
  "grid-3x3": { columns: 3, rows: 3, label: "Grille 3×3" },
};

export const layoutCellCount = (layout: CarouselLayout) => CAROUSEL_LAYOUTS[layout].columns * CAROUSEL_LAYOUTS[layout].rows;

// ---- Text ----

export const CAROUSEL_TEXT = {
  minFontSize: 8,
  maxFontSize: 160,
  /** Auto-width text boxes wrap at this share of the slide width (%). */
  maxAutoWidth: 86,
  minWidth: 12,
  lineHeight: 1.25,
  maxOutlineWidth: 12,
  maxBackgroundRadius: 36,
  /** Inner padding of the text box, base frame px. */
  paddingX: 8,
  paddingY: 4,
} as const;

export const CAROUSEL_FONT_WEIGHTS = [400, 600, 700, 800] as const;
export type CarouselFontWeight = (typeof CAROUSEL_FONT_WEIGHTS)[number];
export type CarouselTextAlign = "left" | "center" | "right";
export type CarouselTextShadow = "none" | "soft" | "strong";

/** Font of the slides' text (Google Fonts, loaded on demand by the client). */
export const CAROUSEL_FONT_FAMILY = "Outfit";
export const CAROUSEL_FONT_STACK = `"${CAROUSEL_FONT_FAMILY}", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

// ---- Document ----

const id = z.string().min(1).max(64);
const color = z.string().min(1).max(32);
const percent = z.number().min(0).max(100);

const imageSchema = z.object({
  id,
  /** Public URL in the R2 bucket (shared/storage.ts); null for an empty cell. */
  url: z.string().url().max(2000).nullable(),
  /** Which part of the image stays visible when it is cropped to its cell (cover), in %. */
  focalX: percent.default(50),
  focalY: percent.default(50),
});

const textLayerSchema = z.object({
  id,
  text: z.string().max(2000),
  x: percent,
  y: percent,
  /** % of the slide width; null: as wide as the text, up to CAROUSEL_TEXT.maxAutoWidth. */
  width: z.number().min(CAROUSEL_TEXT.minWidth).max(100).nullable().default(null),
  fontSize: z.number().min(CAROUSEL_TEXT.minFontSize).max(CAROUSEL_TEXT.maxFontSize),
  fontWeight: z.union([z.literal(400), z.literal(600), z.literal(700), z.literal(800)]).default(700),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
  color: color.default("#ffffff"),
  /** "transparent" or a colour (#rrggbbaa for a translucent box). */
  backgroundColor: color.default("transparent"),
  backgroundRadius: z.number().min(0).max(CAROUSEL_TEXT.maxBackgroundRadius).default(6),
  outlineColor: color.default("#000000"),
  outlineWidth: z.number().min(0).max(CAROUSEL_TEXT.maxOutlineWidth).default(0),
  shadow: z.enum(["none", "soft", "strong"]).default("none"),
  shadowIntensity: percent.default(50),
});

const slideSchema = z.object({
  id,
  layout: z.enum(CAROUSEL_LAYOUT_IDS),
  /** Colour behind the images (and of the empty cells). */
  background: color.default("#1c1c1c"),
  /** One per cell of the layout, in reading order. */
  images: z.array(imageSchema).max(9),
  /** Drawn in order: the last one is on top. */
  textLayers: z.array(textLayerSchema).max(20),
});

export const CAROUSEL_MAX_SLIDES = 20;

export const carouselDocumentSchema = z.object({
  version: z.literal(CAROUSEL_DOCUMENT_VERSION),
  ratio: z.enum(CAROUSEL_RATIO_IDS),
  slides: z.array(slideSchema).min(1).max(CAROUSEL_MAX_SLIDES),
});

export type CarouselImage = z.infer<typeof imageSchema>;
export type CarouselTextLayer = z.infer<typeof textLayerSchema>;
export type CarouselSlide = z.infer<typeof slideSchema>;
export type CarouselDocument = z.infer<typeof carouselDocumentSchema>;

export const createCarouselId = () => globalThis.crypto.randomUUID();

/** The images of a layout, keeping the existing ones in their cells. */
export function imagesForLayout(layout: CarouselLayout, existing: CarouselImage[] = []): CarouselImage[] {
  return Array.from(
    { length: layoutCellCount(layout) },
    (_, index) => existing[index] ?? { id: createCarouselId(), url: null, focalX: 50, focalY: 50 },
  );
}

export function createSlide(layout: CarouselLayout = "single", background = "#1c1c1c"): CarouselSlide {
  return { id: createCarouselId(), layout, background, images: imagesForLayout(layout), textLayers: [] };
}

export function createTextLayer(overrides: Partial<Omit<CarouselTextLayer, "id">> = {}): CarouselTextLayer {
  return textLayerSchema.parse({ id: createCarouselId(), text: "Nouveau texte", x: 50, y: 50, fontSize: 28, ...overrides });
}

export function createCarouselDocument(ratio: CarouselRatio = "9:16", slideCount = 1): CarouselDocument {
  return {
    version: CAROUSEL_DOCUMENT_VERSION,
    ratio,
    slides: Array.from({ length: Math.max(1, slideCount) }, () => createSlide()),
  };
}

/** A stored document, normalized (missing style fields get their defaults); null when unusable. */
export function parseCarouselDocument(value: unknown): CarouselDocument | null {
  const parsed = carouselDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Slides worth exporting: with an image or some text. */
export const slideHasContent = (slide: CarouselSlide) =>
  slide.images.some((image) => image.url) || slide.textLayers.some((layer) => layer.text.trim());

// ---- Carousels (rows) and AI generation ----

export const CAROUSEL_TITLE_MAX_LENGTH = 80;
export const DEFAULT_CAROUSEL_TITLE = "Nouveau carrousel";

/** Carousels a member can generate per rolling 24 hours (failed generations do not count). */
export const CAROUSEL_GENERATIONS_PER_DAY = 5;
export const CAROUSEL_TOPIC_MAX_LENGTH = 1000;
export const CAROUSEL_GENERATED_SLIDES = { min: 3, max: 10, default: 6 } as const;

/** OneShotAPI image model of the generated slides, and its output resolution (2K: sharp at 1080 px). */
export const CAROUSEL_IMAGE_MODEL = "nano-banana-2";
export const CAROUSEL_IMAGE_RESOLUTION = "2K";

/**
 * Rules added after the imagePrompt of every slide (not editable: the text is laid over the image
 * and must stay editable, so the model draws none). `format`: "Vertical 9:16", for instance.
 */
export const carouselImageRules = (format: string) =>
  `No text, letters, numbers, captions, logos or watermarks anywhere in the image. ${format} composition with a calm area for overlaid text.`;

/** What the image model receives for one slide. */
export const carouselImagePrompt = (imagePrompt: string, ratio: CarouselRatio) =>
  `${imagePrompt}\n\n${carouselImageRules(`${CAROUSEL_RATIOS[ratio].detail} ${ratio}`)}`;

/** Images added in the editor (types: IMAGE_TYPES of shared/storage.ts, stored in the R2 bucket). */
export const CAROUSEL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

// ---- Text styles of the AI generation ----

export const CAROUSEL_TEXT_STYLE_IDS = ["dark-box", "light-box", "outline", "shadow"] as const;
export type CarouselTextStyle = (typeof CAROUSEL_TEXT_STYLE_IDS)[number];
export const DEFAULT_CAROUSEL_TEXT_STYLE: CarouselTextStyle = "dark-box";

type CarouselTextLook = Pick<CarouselTextLayer, "color" | "backgroundColor" | "backgroundRadius" | "outlineColor" | "shadow" | "shadowIntensity"> & {
  /** Width of the outline, as a share of the font size (0: none). */
  outline: number;
};

/**
 * The looks a member picks for the text of a generated carousel ("Générer avec l'IA",
 * NewCarouselDialog), each readable on any image: the style of its text layers
 * (server/content/generated-document.ts). Everything stays editable in the editor.
 */
export const CAROUSEL_TEXT_STYLES: Record<CarouselTextStyle, { label: string; look: CarouselTextLook }> = {
  "dark-box": {
    label: "Fond noir",
    look: { color: "#ffffff", backgroundColor: "#000000b3", backgroundRadius: 8, outlineColor: "#000000", outline: 0, shadow: "none", shadowIntensity: 50 },
  },
  "light-box": {
    label: "Fond blanc",
    look: { color: "#111111", backgroundColor: "#ffffff", backgroundRadius: 8, outlineColor: "#000000", outline: 0, shadow: "none", shadowIntensity: 50 },
  },
  outline: {
    label: "Contour",
    look: { color: "#ffffff", backgroundColor: "transparent", backgroundRadius: 6, outlineColor: "#000000", outline: 0.09, shadow: "none", shadowIntensity: 50 },
  },
  shadow: {
    label: "Ombre",
    look: { color: "#ffffff", backgroundColor: "transparent", backgroundRadius: 6, outlineColor: "#000000", outline: 0, shadow: "strong", shadowIntensity: 100 },
  },
};

/** The style fields of a text layer of this font size in this look (its outline follows the size). */
export function carouselTextStyleFields(style: CarouselTextStyle, fontSize: number) {
  const { outline, ...look } = CAROUSEL_TEXT_STYLES[style].look;
  return { ...look, outlineWidth: Math.min(CAROUSEL_TEXT.maxOutlineWidth, Math.round(fontSize * outline * 2) / 2) };
}

export type CarouselStatus = "generating" | "ready" | "failed";

export const generateCarouselBodySchema = z.object({
  saasId: z.string().uuid(),
  topic: z
    .string()
    .trim()
    .min(3, "Décris le sujet en quelques mots")
    .max(CAROUSEL_TOPIC_MAX_LENGTH, `${CAROUSEL_TOPIC_MAX_LENGTH} caractères maximum`),
  slideCount: z.number().int().min(CAROUSEL_GENERATED_SLIDES.min).max(CAROUSEL_GENERATED_SLIDES.max),
  ratio: z.enum(CAROUSEL_RATIO_IDS),
  textStyle: z.enum(CAROUSEL_TEXT_STYLE_IDS).default(DEFAULT_CAROUSEL_TEXT_STYLE),
});
export type GenerateCarouselBody = z.infer<typeof generateCarouselBodySchema>;

/** Generations left: `nextAvailableAt` is when one frees up, once the quota is reached. */
export type CarouselQuota = { used: number; limit: number; nextAvailableAt: string | null };

export const carouselApi = {
  /** POST GenerateCarouselBody → 202 with the carousel row (status "generating"), generated in the background. */
  generate: { path: "/api/content/carousels/generate" },
  /** GET → CarouselQuota. */
  quota: { path: "/api/content/carousels/quota" },
  /**
   * POST an image (raw body, its Content-Type) → 201 { url }: stored in the carousel's folder.
   * DELETE ?saasId=, once the carousel is deleted → 204: removes its images.
   */
  images: { path: (carouselId: string) => `/api/content/carousels/${carouselId}/images` },
} as const;
