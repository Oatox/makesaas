import { randomUUID } from "node:crypto";
import express, { type Request, type RequestHandler } from "express";
import { IMAGE_EXTENSIONS, IMAGE_TYPES, IMAGE_TYPES_LABEL, type ImageType } from "@shared/storage";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";
import { storage, type R2Storage } from "./r2";

/** Layout of the bucket (shared/storage.ts): every key starts with its owner's id. */
export const storageKeys = {
  user: (userId: string) => `${userId}/`,
  saas: (userId: string, saasId: string) => `${userId}/${saasId}/`,
  carousel: (userId: string, saasId: string, carouselId: string) => `${userId}/${saasId}/carousels/${carouselId}/`,
  saasLogo: (userId: string, saasId: string) => `${userId}/${saasId}/logo/`,
};

/** Real type of an image from its first bytes: the Content-Type a client announces is not trusted. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const ascii = (start: number, end: number) => Array.from(bytes.subarray(start, end), (byte) => String.fromCharCode(byte)).join("");
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Reads a raw image body (sent with its image/* Content-Type) of at most `maxBytes`; read it with
 * readImage. Put it after the auth middleware, so nothing is read for a rejected request.
 */
export function imageBody(maxBytes: number, tooLargeMessage: string): RequestHandler {
  const parse = express.raw({ type: [...IMAGE_TYPES], limit: maxBytes });
  return (req, res, next) =>
    parse(req, res, (err?: unknown) => {
      if ((err as { type?: string } | undefined)?.type === "entity.too.large") return next(new HttpError(413, tooLargeMessage));
      next(err);
    });
}

export type UploadedImage = { bytes: Buffer; type: ImageType };

/** The image read by imageBody, checked on its bytes. */
export function readImage(req: Request): UploadedImage {
  const bytes: unknown = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new HttpError(400, `Envoie une image ${IMAGE_TYPES_LABEL}.`);
  const type = detectImageType(bytes);
  if (!type) throw new HttpError(415, `Formats acceptés : ${IMAGE_TYPES_LABEL}.`);
  return { bytes, type };
}

/** Stores an image under `prefix` with a new name; returns its public URL. */
export async function storeImage(files: R2Storage, prefix: string, image: UploadedImage): Promise<string> {
  const key = `${prefix}${randomUUID()}.${IMAGE_EXTENSIONS[image.type]}`;
  try {
    return await files.put(key, image.bytes, image.type);
  } catch (err) {
    logger.error({ err, key }, "Failed to store a file in R2");
    throw new HttpError(502, "L'image n'a pas pu être enregistrée, réessaie dans un instant.");
  }
}

/** Best effort: removes a file of the bucket from its public URL (other URLs are ignored). */
export async function removeFileByUrl(files: R2Storage, url: string | null | undefined) {
  const key = url ? files.keyOf(url) : null;
  if (!key) return;
  await files.delete(key).catch((err) => logger.warn({ err, key }, "Failed to remove a file from R2"));
}

/** Best effort: removes every file of a deleted account. */
export async function removeUserFiles(userId: string) {
  if (!storage) return;
  await storage
    .deletePrefix(storageKeys.user(userId))
    .catch((err) => logger.error({ err, userId }, "Failed to remove the files of a deleted user"));
}
