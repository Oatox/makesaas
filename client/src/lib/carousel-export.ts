import { CAROUSEL_RATIOS, slideHasContent, type CarouselDocument } from "@shared/carousel";
import { drawCarouselSlide, type LoadedImage } from "@shared/carousel-renderer";
import { loadCarouselFont } from "./carousel-font";

/**
 * Download of a carousel: each slide drawn by the shared Canvas renderer at its export size (1080 px
 * wide), as one PNG, or a zip of PNGs (1.png, 2.png...) for several slides. The zip is written by
 * hand (stored, uncompressed: PNGs are already compressed), so no dependency is needed.
 */

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Impossible de générer l'image d'une slide."))), "image/png"),
  );
}

// ---- Minimal zip writer ----

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function createZip(files: { name: string; blob: Blob }[]) {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(new Date());
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true); // UTF-8 names
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);

    const header = new Uint8Array(46 + name.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, 0x02014b50, true);
    headerView.setUint16(4, 20, true);
    headerView.setUint16(6, 20, true);
    headerView.setUint16(8, 0x0800, true);
    headerView.setUint16(12, stamp.time, true);
    headerView.setUint16(14, stamp.date, true);
    headerView.setUint32(16, crc, true);
    headerView.setUint32(20, data.length, true);
    headerView.setUint32(24, data.length, true);
    headerView.setUint16(28, name.length, true);
    headerView.setUint32(42, offset, true);
    header.set(name, 46);

    parts.push(local, data);
    central.push(header);
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((size, header) => size + header.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

// ---- Download ----

function safeFileName(name: string) {
  // NFD splits accented letters ("é" → "e" + accent); the accents then go with the other symbols.
  const safe = name
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return safe || "carrousel";
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadCarousel(title: string, document: CarouselDocument) {
  const slides = document.slides.filter(slideHasContent);
  if (slides.length === 0) throw new Error("Ce carrousel est vide : ajoute une image ou un texte.");

  await loadCarouselFont();

  // Fetched as blobs (the bucket allows CORS): the canvas stays exportable, never "tainted".
  const bitmaps = new Map<string, Promise<ImageBitmap | null>>();
  const loadImage = (url: string): Promise<LoadedImage | null> => {
    if (!bitmaps.has(url)) {
      bitmaps.set(
        url,
        fetch(url)
          .then((response) => (response.ok ? response.blob() : null))
          .then((blob) => (blob ? createImageBitmap(blob) : null))
          .catch(() => null),
      );
    }
    return bitmaps.get(url)!;
  };

  try {
    const { width, height } = CAROUSEL_RATIOS[document.ratio].export;
    const files: { name: string; blob: Blob }[] = [];
    for (let index = 0; index < slides.length; index++) {
      const canvas = window.document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Ton navigateur ne permet pas d'exporter les images.");
      await drawCarouselSlide({ context, slide: slides[index], ratio: document.ratio, loadImage });
      files.push({ name: `${index + 1}.png`, blob: await canvasToPng(canvas) });
    }

    const name = safeFileName(title);
    if (files.length === 1) triggerDownload(files[0].blob, `${name}.png`);
    else triggerDownload(await createZip(files.map((file) => ({ ...file, name: `${name}/${file.name}` }))), `${name}.zip`);
  } finally {
    for (const bitmap of Array.from(bitmaps.values())) void bitmap.then((loaded) => loaded?.close());
  }
}
