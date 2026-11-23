import {
  CAROUSEL_FONT_STACK,
  CAROUSEL_LAYOUTS,
  CAROUSEL_RATIOS,
  CAROUSEL_TEXT,
  type CarouselImage,
  type CarouselRatio,
  type CarouselSlide,
  type CarouselTextLayer,
  type CarouselTextShadow,
} from "./carousel";

/**
 * Draws a slide on a Canvas 2D context, at any size (the export is 1080 px wide). It mirrors the DOM
 * rendering of the editor (client/src/components/content/SlideView.tsx): keep both in sync.
 */

export type ShadowLayer = { offsetY: number; blur: number; color: string };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Shadow passes of a text, in base frame px (multiply by the export scale). Same for DOM and Canvas. */
export function textShadowLayers(shadow: CarouselTextShadow, intensity: number): ShadowLayer[] {
  const ratio = clamp(intensity, 0, 100) / 100;
  if (shadow === "none" || ratio <= 0) return [];
  if (shadow === "soft") {
    return [
      {
        offsetY: Math.round(1 + ratio * 3),
        blur: Math.round(4 + ratio * 10),
        color: `rgba(0, 0, 0, ${Math.min(0.5, 0.16 + ratio * 0.34).toFixed(2)})`,
      },
    ];
  }
  return [
    {
      offsetY: Math.round(2 + ratio * 5),
      blur: Math.round(6 + ratio * 18),
      color: `rgba(0, 0, 0, ${Math.min(0.78, 0.24 + ratio * 0.54).toFixed(2)})`,
    },
    { offsetY: 1, blur: Math.round(1 + ratio * 3), color: "rgba(0, 0, 0, 0.82)" },
  ];
}

export function canvasFont(layer: Pick<CarouselTextLayer, "fontWeight" | "italic">, fontSize: number) {
  return `${layer.italic ? "italic" : "normal"} ${layer.fontWeight} ${fontSize}px ${CAROUSEL_FONT_STACK}`;
}

/** Greedy word wrap; a word wider than the line is broken by characters. */
function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const fits = (line: string) => context.measureText(line).width <= maxWidth;

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      if (fits(word)) {
        line = word;
        continue;
      }
      for (const character of word) {
        if (line && !fits(line + character)) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

/** Baseline that centres the line box like CSS does (line-height around the font's ascent/descent). */
function lineBaseline(context: CanvasRenderingContext2D, lineTop: number, lineHeight: number, fontSize: number) {
  const metrics = context.measureText("Mg");
  const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.9;
  const descent = metrics.fontBoundingBoxDescent || fontSize * 0.25;
  return lineTop + (lineHeight - ascent - descent) / 2 + ascent;
}

function drawTextLayer(context: CanvasRenderingContext2D, layer: CarouselTextLayer, size: { width: number; height: number }, scale: number) {
  if (!layer.text.trim()) return;

  const fontSize = clamp(layer.fontSize, CAROUSEL_TEXT.minFontSize, CAROUSEL_TEXT.maxFontSize) * scale;
  const paddingX = CAROUSEL_TEXT.paddingX * scale;
  const paddingY = CAROUSEL_TEXT.paddingY * scale;
  const lineHeight = fontSize * CAROUSEL_TEXT.lineHeight;
  const fixedWidth = layer.width === null ? null : (size.width * layer.width) / 100;
  const maxBoxWidth = fixedWidth ?? (size.width * CAROUSEL_TEXT.maxAutoWidth) / 100;

  context.save();
  context.font = canvasFont(layer, fontSize);
  context.textBaseline = "alphabetic";
  context.textAlign = "left";

  const lines = wrapText(context, layer.text, Math.max(1, maxBoxWidth - paddingX * 2));
  const widths = lines.map((line) => context.measureText(line).width);
  const boxWidth = fixedWidth ?? Math.min(maxBoxWidth, Math.max(...widths) + paddingX * 2);
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const boxX = (layer.x / 100) * size.width - boxWidth / 2;
  const boxY = (layer.y / 100) * size.height - boxHeight / 2;

  if (layer.backgroundColor !== "transparent") {
    context.fillStyle = layer.backgroundColor;
    roundedRect(context, boxX, boxY, boxWidth, boxHeight, layer.backgroundRadius * scale);
    context.fill();
  }

  const lineStart = (index: number) => {
    if (layer.textAlign === "left") return boxX + paddingX;
    if (layer.textAlign === "right") return boxX + boxWidth - paddingX - widths[index];
    return boxX + (boxWidth - widths[index]) / 2;
  };
  const outlineWidth = clamp(layer.outlineWidth, 0, CAROUSEL_TEXT.maxOutlineWidth) * scale;

  const drawLines = () => {
    lines.forEach((line, index) => {
      const x = lineStart(index);
      const baseline = lineBaseline(context, boxY + paddingY + index * lineHeight, lineHeight, fontSize);
      if (outlineWidth > 0) {
        context.save();
        context.strokeStyle = layer.outlineColor;
        // The DOM draws a stroke centred on the glyph edge, twice as wide as the outline.
        context.lineWidth = outlineWidth * 2;
        context.lineJoin = "round";
        context.miterLimit = 2;
        context.strokeText(line, x, baseline);
        context.restore();
      }
      context.fillStyle = layer.color;
      context.fillText(line, x, baseline);
    });
  };

  for (const shadow of textShadowLayers(layer.shadow, layer.shadowIntensity)) {
    context.save();
    context.shadowColor = shadow.color;
    context.shadowBlur = shadow.blur * scale;
    context.shadowOffsetY = shadow.offsetY * scale;
    drawLines();
    context.restore();
  }
  drawLines();

  if (layer.underline) {
    context.strokeStyle = layer.color;
    context.lineWidth = Math.max(1, fontSize * 0.05);
    lines.forEach((line, index) => {
      const baseline = lineBaseline(context, boxY + paddingY + index * lineHeight, lineHeight, fontSize);
      const y = baseline + fontSize * 0.08;
      context.beginPath();
      context.moveTo(lineStart(index), y);
      context.lineTo(lineStart(index) + widths[index], y);
      context.stroke();
    });
  }

  context.restore();
}

/** Draws `image` cropped to cover the cell, keeping its focal point in view (CSS object-fit: cover). */
function drawImageCover(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource & { width: number; height: number },
  image: CarouselImage,
  cell: { x: number; y: number; width: number; height: number },
) {
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  if (!sourceWidth || !sourceHeight) return;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceWidth / sourceHeight > cell.width / cell.height) cropWidth = sourceHeight * (cell.width / cell.height);
  else cropHeight = sourceWidth / (cell.width / cell.height);
  const cropX = (sourceWidth - cropWidth) * (image.focalX / 100);
  const cropY = (sourceHeight - cropHeight) * (image.focalY / 100);

  context.drawImage(source, cropX, cropY, cropWidth, cropHeight, cell.x, cell.y, cell.width, cell.height);
}

/** Cells of a layout in a frame, separated by a 1 base px gap. */
export function layoutCells(slide: Pick<CarouselSlide, "layout">, size: { width: number; height: number }, gap: number) {
  const { columns, rows } = CAROUSEL_LAYOUTS[slide.layout];
  const width = (size.width - gap * (columns - 1)) / columns;
  const height = (size.height - gap * (rows - 1)) / rows;
  return Array.from({ length: columns * rows }, (_, index) => ({
    x: (index % columns) * (width + gap),
    y: Math.floor(index / columns) * (height + gap),
    width,
    height,
  }));
}

export type LoadedImage = CanvasImageSource & { width: number; height: number };

export async function drawCarouselSlide({
  context,
  slide,
  ratio,
  loadImage,
}: {
  context: CanvasRenderingContext2D;
  slide: CarouselSlide;
  ratio: CarouselRatio;
  /** Loaded image of a URL, or null when it cannot be loaded (the cell stays empty). */
  loadImage: (url: string) => Promise<LoadedImage | null>;
}) {
  const size = CAROUSEL_RATIOS[ratio].export;
  const scale = size.width / CAROUSEL_RATIOS[ratio].base.width;

  context.fillStyle = slide.background;
  context.fillRect(0, 0, size.width, size.height);

  const cells = layoutCells(slide, size, Math.round(scale));
  for (let index = 0; index < cells.length; index++) {
    const image = slide.images[index];
    const source = image?.url ? await loadImage(image.url) : null;
    if (image && source) drawImageCover(context, source, image, cells[index]);
  }

  for (const layer of slide.textLayers) drawTextLayer(context, layer, size, scale);
}
