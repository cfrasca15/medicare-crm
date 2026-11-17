import { prisma } from "@/lib/prisma";
import { todayInputValue } from "@/lib/date";

// Turning 65: the Initial Enrollment Period runs from 3 months before the
// month of a 65th birthday to 3 months after, so the people worth reaching
// are the ones whose 65th birthday is up to 6 months ahead or up to 3 months
// back. Used by the Birthdays page and the Dashboard.

// Days from today (Pacific) to a 65th birthday; negative once it has passed.
export function daysTo65(dateOfBirth: Date, today = todayInputValue()): number {
  const [y, m, d] = today.split("-").map(Number);
  const turns65 = Date.UTC(dateOfBirth.getUTCFullYear() + 65, dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate());
  return Math.round((turns65 - Date.UTC(y, m - 1, d)) / 86_400_000);
}

export const inTurning65Window = (days: number) => days >= -92 && days <= 183;

// How many contacts (not Lost) are in that window right now.
export async function countTurning65(): Promise<number> {
  const today = todayInputValue();
  // Only birth dates near the window are worth reading; the exact test is below.
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCFullYear(from.getUTCFullYear() - 65);
  const to = new Date(from);
  from.setUTCDate(from.getUTCDate() - 100);
  to.setUTCDate(to.getUTCDate() + 190);
  const rows = await prisma.contact.findMany({
    where: { stage: { not: "LOST" }, dateOfBirth: { gte: from, lte: to } },
    select: { dateOfBirth: true },
  });
  return rows.filter((r) => inTurning65Window(daysTo65(r.dateOfBirth!, today))).length;
}
