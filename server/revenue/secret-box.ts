import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { logger } from "../lib/logger";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Encrypts the API keys of connected accounts (AES-256-GCM) before they are stored. */
export class SecretBox {
  constructor(private readonly key: Buffer) {}

  seal(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url")}`;
  }

  /** Throws when the value was sealed with another key or tampered with. */
  open(sealed: string): string {
    const [version, payload] = sealed.split(".");
    if (version !== VERSION || !payload) throw new Error("Unknown sealed secret format");
    const bytes = Buffer.from(payload, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", this.key, bytes.subarray(0, IV_BYTES));
    decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
  }
}

/**
 * REVENUE_ENCRYPTION_KEY: 32 random bytes, as 64 hex characters or base64 (`openssl rand -hex 32`).
 * Without it, a key derived from SUPABASE_SECRET_KEY: rotating that one then makes the stored API
 * keys unreadable (the members reconnect their accounts). Null when neither is set.
 */
export function loadSecretBox(): SecretBox | null {
  const configured = process.env.REVENUE_ENCRYPTION_KEY?.trim();
  if (configured) {
    const key = /^[0-9a-f]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
    if (key.length === 32) return new SecretBox(key);
    logger.error("REVENUE_ENCRYPTION_KEY must hold 32 bytes (64 hex characters or base64): revenue connections are disabled");
    return null;
  }

  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseSecret) return null;
  logger.warn("REVENUE_ENCRYPTION_KEY missing: connected API keys are encrypted with a key derived from SUPABASE_SECRET_KEY");
  return new SecretBox(Buffer.from(hkdfSync("sha256", supabaseSecret, "makesaas", "revenue-connections", 32)));
}
