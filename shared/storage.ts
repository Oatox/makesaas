/**
 * Files members upload (carousel images, SaaS logos) live in a Cloudflare R2 bucket, never in
 * Supabase Storage. Only the server writes there (server/storage/): it checks who owns what and the
 * real type of each file. The bucket is public for reading, so the files are shown by their URL.
 *
 * Keys: <user_id>/<saas_id>/carousels/<carousel_id>/<file> and <user_id>/<saas_id>/logo/<file>, so
 * deleting a carousel, a SaaS or an account removes a single prefix.
 */

/** Image types accepted everywhere (the server checks the file's bytes, not the announced type). */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const IMAGE_TYPES_LABEL = "PNG, JPG ou WebP";

export function isImageType(type: string): type is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}
