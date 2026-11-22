import type { Express } from "express";
import { logger } from "../lib/logger";

/** Path Apple fetches to verify a domain before Apple Pay can run on it. */
export const APPLE_PAY_DOMAIN_FILE_PATH = "/.well-known/apple-developer-merchantid-domain-association";

/** Whop's file (Whop is the Apple Pay platform integrator), proxied as its docs suggest. */
const WHOP_DOMAIN_FILE_URL =
  "https://whop.com/.well-known/apple-platform-integrator/apple-developer-merchantid-domain-association";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Serves the Apple Pay domain association file, needed for the Apple Pay and Google Pay buttons of
 * Whop's embedded checkout on our own domain (once the domain has Apple Pay in the Whop dashboard).
 * Registered as a route because express.static ignores dot directories such as `.well-known`.
 */
export function registerApplePayDomainFile(app: Express) {
  let cached: { body: Buffer; expiresAt: number } | null = null;

  app.get(APPLE_PAY_DOMAIN_FILE_PATH, async (_req, res) => {
    if (!cached || cached.expiresAt < Date.now()) {
      try {
        const response = await fetch(WHOP_DOMAIN_FILE_URL);
        if (!response.ok) throw new Error(`Whop answered ${response.status}`);
        cached = { body: Buffer.from(await response.arrayBuffer()), expiresAt: Date.now() + CACHE_TTL_MS };
      } catch (err) {
        logger.error({ err }, "Failed to fetch the Apple Pay domain association file from Whop");
        // A stale copy still verifies the domain; without one, Apple retries later.
        if (!cached) return res.status(502).type("text/plain").send("Unavailable");
      }
    }

    res.type("application/octet-stream").set("Cache-Control", "public, max-age=3600").send(cached.body);
  });
}
