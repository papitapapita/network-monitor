import { SubscriptionTerms } from 'domain/shared/value-objects';

export const DEFAULT_GRACE_DAYS = 3;
export const DEFAULT_READ_ONLY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// Customers are Colombian ISPs; Colombia is UTC-5 with no daylight saving.
const INSTALL_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;

// SUBSCRIPTION_PAID_UNTIL is the last day paid for (YYYY-MM-DD), covered to
// its end in Colombian time. Unset means the install is not billed this way
// — Insetel's own — and nothing is enforced. A malformed value stops the
// boot: guessing a date would either cut off a paying customer or never cut
// off anyone.
export function loadSubscriptionTerms(
  env: NodeJS.ProcessEnv
): SubscriptionTerms | null {
  const rawDate = env.SUBSCRIPTION_PAID_UNTIL?.trim();
  if (!rawDate) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  const [year, month, day] = match ? match.slice(1).map(Number) : [];
  const utcMidnight = match ? Date.UTC(year, month - 1, day) : NaN;
  if (
    isNaN(utcMidnight) ||
    new Date(utcMidnight).getUTCDate() !== day ||
    new Date(utcMidnight).getUTCMonth() !== month - 1
  ) {
    throw new Error(
      `SUBSCRIPTION_PAID_UNTIL must be a real date as YYYY-MM-DD, got "${rawDate}"`
    );
  }
  // Midnight after the last paid day, in Colombian time.
  const paidThrough = new Date(
    utcMidnight + DAY_MS - INSTALL_UTC_OFFSET_MS
  );

  const terms = SubscriptionTerms.create(
    paidThrough,
    parseDays(env.SUBSCRIPTION_GRACE_DAYS, DEFAULT_GRACE_DAYS),
    parseDays(env.SUBSCRIPTION_READ_ONLY_DAYS, DEFAULT_READ_ONLY_DAYS)
  );
  if (terms.isFailure) {
    throw new Error(
      `SUBSCRIPTION_GRACE_DAYS / SUBSCRIPTION_READ_ONLY_DAYS: ${terms.error}`
    );
  }
  return terms.value;
}

// Anything but plain digits becomes NaN, which the terms reject.
function parseDays(
  raw: string | undefined,
  fallback: number
): number {
  const value = raw?.trim();
  if (value === undefined || value === '') return fallback;
  return /^\d+$/.test(value) ? Number(value) : NaN;
}
