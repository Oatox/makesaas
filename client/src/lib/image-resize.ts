const UNREADABLE = "Image illisible : essaie un autre fichier.";

/**
 * Redraws an image file so it fits a `size` × `size` square (never enlarged, proportions and
 * transparency kept), as WebP, or PNG in the browsers that cannot encode WebP.
 */
export async function resizeImageToFit(file: Blob, size: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(UNREADABLE);
  });
  try {
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(UNREADABLE);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
    if (!blob) throw new Error(UNREADABLE);
    return blob;
  } finally {
    bitmap.close();
  }
}
