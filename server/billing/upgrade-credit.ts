const DAY_MS = 24 * 60 * 60 * 1000;

/** Whop's limit for memberships.extend. */
export const MAX_CREDIT_DAYS = 1095;

export type UpgradeCreditInput = {
  now: Date;
  /** End of the paid period of the replaced (Starter) membership, ISO 8601. */
  oldPeriodEnd: string | null;
  /** What the replaced membership charges per period, and its period length in days. */
  oldPrice: number;
  oldPeriodDays: number | null;
  /** Same for the new (Pro) membership. */
  newPrice: number;
  newPeriodDays: number | null;
};

/**
 * Starter → Pro upgrade: the value of the Starter days already paid but not used yet, converted into free
 * Pro days (rounded to the nearest day). 0 when nothing is left or the prices cannot be compared.
 * E.g. 15 days left of a 10 €/30 days Starter = 5 € = 7.5 → 8 days of a 20 €/30 days Pro.
 */
export function upgradeCreditDays(input: UpgradeCreditInput): number {
  const { now, oldPeriodEnd, oldPrice, oldPeriodDays, newPrice, newPeriodDays } = input;
  if (!oldPeriodEnd || !oldPeriodDays || !newPeriodDays) return 0;
  if (!(oldPrice > 0) || !(newPrice > 0)) return 0;

  const end = Date.parse(oldPeriodEnd);
  if (Number.isNaN(end)) return 0;
  const remainingDays = Math.max(0, (end - now.getTime()) / DAY_MS);

  const unusedValue = remainingDays * (oldPrice / oldPeriodDays);
  const days = Math.round(unusedValue / (newPrice / newPeriodDays));
  return Math.min(Math.max(days, 0), MAX_CREDIT_DAYS);
}
