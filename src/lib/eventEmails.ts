import { prisma } from "@/lib/prisma";
import { getGoogleAccount, sendGmailMessage } from "@/lib/google";
import { todayInputValue } from "@/lib/date";
import { renderTemplate, type MilestoneEmailResult } from "@/lib/milestoneEmails";
import { emailSendDay } from "@/lib/events";

export type EventEmailKind = "attended" | "missed";

const TEMPLATE_ID: Record<EventEmailKind, "eventAttended" | "eventMissed"> = {
  attended: "eventAttended",
  missed: "eventMissed",
};

export const EVENT_EMAIL_LABEL: Record<string, string> = {
  attended: "Thank-you",
  missed: "Missed-you",
};

// "Pat", "Pat and Sam", "Pat, Sam and Lee": a couple sharing one address gets one email.
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Sends the "thanks for coming" email to guests who came and the "sorry we
// missed you" email to those who didn't, once per guest per event. Nothing
// goes out for an event until "Attendance is finished" has been clicked.
//
// With no eventId this is the 9 AM job: it covers every event whose send day
// (the morning after attendance was finished) has arrived, so a missed
// morning is caught by the next one. With an eventId it's "Send now".
export async function sendEventEmails(opts: { eventId?: string; now?: Date } = {}): Promise<MilestoneEmailResult> {
  const result: MilestoneEmailResult = { sent: 0, skipped: 0, errors: [] };
  const now = opts.now ?? new Date();

  const events = (
    await prisma.event.findMany({
      where: { attendanceDoneAt: { not: null }, ...(opts.eventId ? { id: opts.eventId } : {}) },
      include: { guests: true },
    })
  ).filter((e) => opts.eventId || emailSendDay(e.attendanceDoneAt!) <= todayInputValue(now));

  const waiting = events.some((e) => e.guests.some((g) => g.attended !== null && !g.emailSentAt && g.email && !g.noEmail));
  if (!waiting) return result;

  if (!(await getGoogleAccount())) {
    result.errors.push({ contactName: "(all)", error: "Google account isn't connected — can't send event emails." });
    return result;
  }

  const templates = await prisma.milestoneEmailTemplate.findMany({
    where: { id: { in: Object.values(TEMPLATE_ID) } },
  });

  for (const event of events) {
    const eventDate = event.date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
    // Addresses this event has already emailed, so a second row for the same
    // person doesn't get a second copy.
    const alreadySent = new Set(
      event.guests.filter((g) => g.emailSentAt && g.email).map((g) => `${g.emailKind}:${g.email!.trim().toLowerCase()}`)
    );

    for (const kind of ["attended", "missed"] as const) {
      const template = templates.find((t) => t.id === TEMPLATE_ID[kind]);
      const due = event.guests.filter((g) => !g.emailSentAt && g.attended === (kind === "attended"));
      if (!template?.enabled) {
        result.skipped += due.length;
        continue;
      }

      const byAddress = new Map<string, typeof due>();
      for (const g of due) {
        const address = g.email?.trim().toLowerCase();
        if (!address || g.noEmail) {
          result.skipped++;
          continue;
        }
        byAddress.set(address, [...(byAddress.get(address) ?? []), g]);
      }

      for (const [address, group] of byAddress) {
        const markSent = () =>
          prisma.eventGuest.updateMany({
            where: { id: { in: group.map((g) => g.id) } },
            data: { emailKind: kind, emailSentAt: now },
          });
        if (alreadySent.has(`${kind}:${address}`)) {
          await markSent();
          continue;
        }

        const vars = {
          firstName: joinNames(group.map((g) => g.firstName)),
          lastName: group[0].lastName,
          eventName: event.name,
          eventDate,
        };
        try {
          await sendGmailMessage({
            to: group[0].email!.trim(),
            subject: renderTemplate(template.subject, vars),
            body: renderTemplate(template.body, vars),
          });
          await markSent();
          const contactIds = group.map((g) => g.contactId).filter((id): id is string => Boolean(id));
          if (contactIds.length) {
            await prisma.activity.createMany({
              data: contactIds.map((contactId) => ({
                contactId,
                type: "email",
                summary: `${EVENT_EMAIL_LABEL[kind]} email sent for event: ${event.name}`,
              })),
            });
          }
          result.sent++;
        } catch (err) {
          result.errors.push({
            contactName: group.map((g) => `${g.firstName} ${g.lastName}`.trim()).join(" and "),
            error: err instanceof Error ? err.message : "Send failed",
          });
        }
      }
    }
  }

  return result;
}
