import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/constants";
import { todayInputValue } from "@/lib/date";

// Records stage changes on each contact's timeline. `via` says what made the
// change (e.g. "Integrity sync"); leave it out for a change made by hand.
export async function logStageChanges(
  changes: { contactId: string; from: string; to: string }[],
  via?: string
): Promise<void> {
  const real = changes.filter((c) => c.from !== c.to);
  if (!real.length) return;
  await prisma.activity.createMany({
    data: real.map((c) => ({
      contactId: c.contactId,
      type: "stage",
      summary: `Stage: ${STAGE_LABELS[c.from] ?? c.from} → ${STAGE_LABELS[c.to] ?? c.to}${via ? ` (${via})` : ""}`,
    })),
  });
  await addReferralThankYous(real.filter((c) => c.to === "ENROLLED").map((c) => c.contactId));
}

// Every stage change goes through logStageChanges, so this is where a
// referred contact becoming Enrolled gets the referrer a thank-you task
// (due today, once per referred contact).
async function addReferralThankYous(enrolledIds: string[]): Promise<void> {
  if (!enrolledIds.length) return;
  const referred = await prisma.contact.findMany({
    where: { id: { in: enrolledIds }, referredById: { not: null } },
    select: { firstName: true, lastName: true, referredById: true },
  });
  for (const c of referred) {
    const referrer = await prisma.contact.findUnique({
      where: { id: c.referredById! },
      select: { id: true, firstName: true },
    });
    if (!referrer) continue;
    const title = `Thank ${referrer.firstName} for referring ${c.firstName} ${c.lastName}`;
    if (await prisma.task.findFirst({ where: { contactId: referrer.id, title }, select: { id: true } })) continue;
    await prisma.task.create({
      data: {
        contactId: referrer.id,
        title,
        notes: `${c.firstName} ${c.lastName} just enrolled. A call or a card goes a long way.`,
        dueDate: new Date(`${todayInputValue()}T00:00:00Z`),
      },
    });
  }
}

export const CALL_OUTCOMES: { value: string; label: string }[] = [
  { value: "talked", label: "Talked" },
  { value: "voicemail", label: "Left voicemail" },
  { value: "no_answer", label: "No answer" },
  { value: "texted", label: "Texted" },
  { value: "wrong_number", label: "Wrong number" },
];

export const CALL_OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  CALL_OUTCOMES.map((o) => [o.value, o.label])
);
