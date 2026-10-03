import { formatDateOnly } from "@/lib/date";

// Effective dates are calendar dates stored as UTC midnight (see date.ts),
// so compare against today's local calendar date expressed the same way.
function todayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

// Month 1 = the month coverage starts (Jan 1 effective → January is Month 1).
export function coverageMonth(effective: Date, now = new Date()): number | null {
  const today = todayUtc(now);
  if (effective > today) return null;
  let months =
    (today.getUTCFullYear() - effective.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - effective.getUTCMonth());
  if (today.getUTCDate() < effective.getUTCDate()) months -= 1;
  return months + 1;
}

export function coverageLabel(effective: Date, now = new Date()): string {
  const month = coverageMonth(effective, now);
  return month === null
    ? `Starts ${formatDateOnly(effective)}`
    : `Effective ${formatDateOnly(effective)} · Month ${month}`;
}

// The policy to track: the most recent one already in force, otherwise the
// soonest upcoming one (e.g. a January 1 start sold during AEP).
export function currentPolicy<T extends { effectiveDate: Date | null }>(policies: T[]): T | null {
  const today = todayUtc();
  const dated = policies.filter((p) => p.effectiveDate) as (T & { effectiveDate: Date })[];
  const inForce = dated
    .filter((p) => p.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());
  if (inForce.length) return inForce[0];
  const upcoming = dated.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
  return upcoming[0] ?? null;
}
