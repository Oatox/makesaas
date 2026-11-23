import { logger } from "../lib/logger";
import type { ExchangeRates } from "./metrics";

/** ECB reference rates (about 30 currencies), free and keyless, updated once per working day. */
const RATES_URL = "https://api.frankfurter.dev/v1/latest";
const TTL_MS = 12 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 10 * 60 * 1000;

let cache: { rates: ExchangeRates | null; expiresAt: number } | null = null;

/** Units of each currency per euro (uppercase codes), or null when the rates cannot be read. */
export async function getExchangeRates(): Promise<ExchangeRates | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.rates;

  try {
    const response = await fetch(RATES_URL, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { rates?: Record<string, number> };
    if (!body.rates) throw new Error("No rates in the response");
    const rates: ExchangeRates = { EUR: 1, ...body.rates };
    cache = { rates, expiresAt: Date.now() + TTL_MS };
    return rates;
  } catch (err) {
    logger.warn({ err }, "Failed to load exchange rates");
    // Keep serving the last known rates rather than none.
    cache = { rates: cache?.rates ?? null, expiresAt: Date.now() + RETRY_AFTER_FAILURE_MS };
    return cache.rates;
  }
}
