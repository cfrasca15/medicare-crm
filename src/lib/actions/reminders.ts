"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface SeasonalWindow {
  /** Task title, unique per year — used to dedupe re-runs. */
  titleForYear: (year: number) => string;
  notes: string;
  /** Given "now", returns the target year and the task's due date. */
  target: (now: Date) => { year: number; dueDate: Date };
}

const AEP: SeasonalWindow = {
  titleForYear: (year) => `AEP ${year} enrollment review call`,
  notes: "Annual Enrollment Period runs Oct 15 – Dec 7. Review current plan and re-shop if needed.",
  target: (now) => {
    // AEP window: Oct 15 - Dec 7. Reminder due 2 weeks before start (Oct 1).
    const currentYear = now.getFullYear();
    const aepEndThisYear = new Date(currentYear, 11, 7); // Dec 7
    const year = now <= aepEndThisYear ? currentYear : currentYear + 1;
    const dueDate = new Date(year, 9, 1); // Oct 1
    return { year, dueDate };
  },
};

const OEP: SeasonalWindow = {
  titleForYear: (year) => `OEP ${year} check-in call`,
  notes: "Medicare Advantage Open Enrollment Period runs Jan 1 – Mar 31. Confirm client is happy with their plan.",
  target: (now) => {
    // OEP window: Jan 1 - Mar 31. Reminder due 2 weeks before start (Dec 18 of prior year).
    const currentYear = now.getFullYear();
    const oepEndThisYear = new Date(currentYear, 2, 31); // Mar 31
    const year = now <= oepEndThisYear ? currentYear : currentYear + 1;
    const dueDate = new Date(year - 1, 11, 18); // Dec 18 of prior year
    return { year, dueDate };
  },
};

async function generateSeasonalReminders(
  window: SeasonalWindow
): Promise<{ created: number; skipped: number }> {
  const { year, dueDate } = window.target(new Date());
  const title = window.titleForYear(year);

  const contacts = await prisma.contact.findMany({
    where: { policies: { some: {} } },
    select: { id: true },
  });

  let created = 0;
  let skipped = 0;

  for (const contact of contacts) {
    const existing = await prisma.task.findFirst({
      where: { contactId: contact.id, title },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.task.create({
      data: {
        contactId: contact.id,
        title,
        notes: window.notes,
        dueDate,
      },
    });
    created++;
  }

  revalidatePath("/tasks");
  revalidatePath("/");

  return { created, skipped };
}

export async function generateAepReminders() {
  return generateSeasonalReminders(AEP);
}

export async function generateOepReminders() {
  return generateSeasonalReminders(OEP);
}
