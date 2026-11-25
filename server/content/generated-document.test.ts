import { describe, expect, test } from "bun:test";
import {
  CAROUSEL_TEXT_STYLE_IDS,
  DEFAULT_CAROUSEL_TEXT_STYLE,
  carouselTextStyleFields,
  generateCarouselBodySchema,
  parseCarouselDocument,
} from "@shared/carousel";
import { buildGeneratedDocument } from "./generated-document";

const slides = [
  { headline: "3 erreurs qui tuent ton SaaS", body: "Et comment les éviter dès ton lancement.", imagePrompt: "a laptop" },
  { headline: "Pas de clients", body: "Tu construis sans parler à personne.", imagePrompt: "a desk" },
  { headline: "Trop de fonctions", body: "", imagePrompt: "a city" },
];
const images = ["https://files.example.com/1.png", null, "https://files.example.com/3.png"];
const layers = (style: (typeof CAROUSEL_TEXT_STYLE_IDS)[number]) =>
  buildGeneratedDocument("9:16", slides, images, style).slides.flatMap((slide) => slide.textLayers);

describe("buildGeneratedDocument", () => {
  test("the default style is the dark box the generation always used", () => {
    expect(DEFAULT_CAROUSEL_TEXT_STYLE).toBe("dark-box");
    for (const layer of layers("dark-box")) {
      expect(layer).toMatchObject({ color: "#ffffff", backgroundColor: "#000000b3", backgroundRadius: 8, outlineWidth: 0, shadow: "none", width: 84 });
    }
  });

  test("every style gives a valid document, in its look", () => {
    for (const style of CAROUSEL_TEXT_STYLE_IDS) {
      const document = buildGeneratedDocument("4:5", slides, images, style);
      expect(parseCarouselDocument(document)).not.toBeNull();
      // Two layers per slide, one when the body is empty.
      expect(document.slides.map((slide) => slide.textLayers.length)).toEqual([2, 2, 1]);
    }
    for (const layer of layers("light-box")) expect(layer).toMatchObject({ color: "#111111", backgroundColor: "#ffffff" });
    for (const layer of layers("shadow")) expect(layer).toMatchObject({ backgroundColor: "transparent", shadow: "strong", outlineWidth: 0 });
  });

  test("the outline follows the font size", () => {
    const [headline, body] = layers("outline");
    expect(headline.backgroundColor).toBe("transparent");
    expect(body.outlineWidth).toBeGreaterThan(0);
    expect(headline.outlineWidth).toBeGreaterThan(body.outlineWidth);
    expect(carouselTextStyleFields("outline", 1000).outlineWidth).toBe(12);
  });
});

describe("generateCarouselBodySchema", () => {
  const body = { saasId: "7c9e6679-7425-40de-944b-e07fc1f90ae7", topic: "Trouver ses premiers clients", slideCount: 6, ratio: "9:16" };

  test("a request without a text style (an older client) gets the default one", () => {
    expect(generateCarouselBodySchema.parse(body).textStyle).toBe("dark-box");
  });

  test("an unknown text style is refused", () => {
    expect(generateCarouselBodySchema.safeParse({ ...body, textStyle: "neon" }).success).toBe(false);
  });
});
