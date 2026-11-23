import type { RevenueData } from "../metrics";

export type ProviderAccount = {
  /** The provider's id of the account (acct_..., biz_...), to recognize a reconnection; null when unreadable. */
  accountId: string | null;
  accountName: string | null;
  /** False for test / sandbox data. */
  livemode: boolean;
};

/** A payment provider read with the member's API key. */
export interface RevenueSource {
  /** Checks the key and reads the account it belongs to. */
  account(): Promise<ProviderAccount>;
  /** Every subscription (for the history) and the payments made since `since` (ms). */
  fetch(since: number, now: number): Promise<RevenueData>;
}

/**
 * Why a provider call failed, with a message (French) safe to show to the member:
 * - invalid_key: the key is wrong or revoked (the member must reconnect)
 * - forbidden: the key lacks a read permission
 * - unavailable: the provider could not be reached (retry later)
 */
export class ProviderError extends Error {
  constructor(
    readonly kind: "invalid_key" | "forbidden" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Months in a billing period of `days` days, snapped to the usual periods (a few days either way). */
export function monthsForDays(days: number): number {
  if (Math.abs(days - 7) <= 1) return 12 / 52;
  if (Math.abs(days - 14) <= 1) return 24 / 52;
  if (Math.abs(days - 365) <= 5) return 12;
  for (const months of [1, 2, 3, 6]) {
    if (Math.abs(days - months * 30) <= 3 * months) return months;
  }
  return days / (365 / 12);
}
