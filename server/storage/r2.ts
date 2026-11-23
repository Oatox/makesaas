import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";

/**
 * The Cloudflare R2 bucket of the files members upload (shared/storage.ts), through its S3 API.
 * Files are written here only; the bucket is public for reading (R2_PUBLIC_URL).
 */

/** A file never changes under its key (a new upload gets a new key): browsers and the CDN keep it. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const REQUEST_TIMEOUT_MS = 30_000;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base URL of the bucket (r2.dev or custom domain), without trailing slash. */
  publicUrl: string;
};

function readConfig(): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL.replace(/\/+$/, ""),
  };
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

const XML_ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const unescapeXml = (value: string) => value.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]);
const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);

export class R2Storage {
  private readonly client: AwsClient;
  private readonly bucketUrl: string;

  constructor(private readonly config: R2Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: "auto",
    });
    this.bucketUrl = `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucket)}`;
  }

  publicUrl(key: string) {
    return `${this.config.publicUrl}/${encodeKey(key)}`;
  }

  /** Key of a file of this bucket from its public URL; null for any other URL. */
  keyOf(url: string): string | null {
    const base = `${this.config.publicUrl}/`;
    if (!url.startsWith(base)) return null;
    try {
      return decodeURIComponent(url.slice(base.length));
    } catch {
      return null;
    }
  }

  /** Writes a file and returns its public URL. */
  async put(key: string, body: Uint8Array, contentType: string): Promise<string> {
    await this.request(`${this.bucketUrl}/${encodeKey(key)}`, {
      method: "PUT",
      body,
      headers: { "Content-Type": contentType, "Cache-Control": IMMUTABLE_CACHE },
    });
    return this.publicUrl(key);
  }

  async delete(key: string): Promise<void> {
    await this.request(`${this.bucketUrl}/${encodeKey(key)}`, { method: "DELETE" });
  }

  /** Deletes every file whose key starts with `prefix` (end it with "/"); returns how many. */
  async deletePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    let continuationToken: string | undefined;
    do {
      const url = new URL(this.bucketUrl);
      url.searchParams.set("list-type", "2");
      url.searchParams.set("prefix", prefix);
      if (continuationToken) url.searchParams.set("continuation-token", continuationToken);
      const xml = await (await this.request(url.toString())).text();

      const keys = Array.from(xml.matchAll(/<Key>([^<]*)<\/Key>/g), (match) => unescapeXml(match[1]));
      if (keys.length > 0) {
        await this.deleteKeys(keys);
        deleted += keys.length;
      }
      const next = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/) : null;
      continuationToken = next ? unescapeXml(next[1]) : undefined;
    } while (continuationToken);
    return deleted;
  }

  /** DeleteObjects: up to 1000 keys, which a listing page never exceeds. */
  private async deleteKeys(keys: string[]) {
    const objects = keys.map((key) => `<Object><Key>${escapeXml(key)}</Key></Object>`).join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>${objects}</Delete>`;
    const response = await this.request(`${this.bucketUrl}?delete`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/xml", "Content-MD5": createHash("md5").update(body).digest("base64") },
    });
    // Quiet mode lists only the keys that could not be deleted.
    const failed = (await response.text()).match(/<Error>[\s\S]*?<\/Error>/);
    if (failed) throw new Error(`R2 could not delete some files: ${failed[0].slice(0, 500)}`);
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.client.fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 500);
      throw new Error(`R2 ${init.method ?? "GET"} failed (${response.status}): ${detail}`);
    }
    return response;
  }
}

const config = readConfig();

/** null when an R2_* variable is missing: uploads answer 503 (see requireStorage). */
export const storage = config ? new R2Storage(config) : null;
if (!storage) logger.warn("R2_* variables missing: file uploads (carousel images, SaaS logos) answer 503");

/** The bucket, or a 503 for the routes that need it. */
export function requireStorage(): R2Storage {
  if (!storage) throw new HttpError(503, "Le stockage des fichiers n'est pas configuré sur ce serveur.");
  return storage;
}
