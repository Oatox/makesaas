import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

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
 * The key is derived from SUPABASE_SECRET_KEY (HKDF): no key of its own to manage. Rotating the
 * Supabase secret key makes the stored API keys unreadable: the members then reconnect their accounts.
 * Null when SUPABASE_SECRET_KEY is not set.
 */
export function loadSecretBox(): SecretBox | null {
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseSecret) return null;
  return new SecretBox(Buffer.from(hkdfSync("sha256", supabaseSecret, "makesaas", "revenue-connections", 32)));
}
