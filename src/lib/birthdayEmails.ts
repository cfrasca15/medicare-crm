import { prisma } from "@/lib/prisma";
import { getGoogleAccount, sendGmailMessage } from "@/lib/google";
import { todayInputValue } from "@/lib/date";
import { renderTemplate, type MilestoneEmailResult } from "@/lib/milestoneEmails";

// Clients only: marketing rules limit unsolicited email to prospects.
const CLIENT_STAGES = ["ENROLLED", "RETAINED", "CURRENT_CLIENT"] as const;

// Sends the "birthday" template to every client whose birthday is today
// (Pacific), once a year; Contact.birthdayEmailYear records the send. A
// February 29 birthday gets it on February 28 in other years. Does nothing
// while the template is switched off on the Milestone Emails settings page.
export async function runBirthdayEmails(now = new Date()): Promise<MilestoneEmailResult> {
  const result: MilestoneEmailResult = { sent: 0, skipped: 0, errors: [] };

  const template = await prisma.milestoneEmailTemplate.findUnique({ where: { id: "birthday" } });
  if (!template?.enabled) return result;
  if (!(await getGoogleAccount())) {
    result.errors.push({ contactName: "(all)", error: "Google account isn't connected — can't send birthday emails." });
    return result;
  }

  const [y, m, d] = todayInputValue(now).split("-").map(Number);
  const isLeapYear = new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1;

  const clients = await prisma.contact.findMany({
    where: {
      stage: { in: [...CLIENT_STAGES] },
      dateOfBirth: { not: null },
      email: { not: null },
      OR: [{ birthdayEmailYear: null }, { birthdayEmailYear: { lt: y } }],
    },
    select: { id: true, firstName: true, lastName: true, email: true, dateOfBirth: true },
  });

  // Birth dates are calendar dates stored at UTC midnight (see date.ts).
  const due = clients.filter((c) => {
    const bm = c.dateOfBirth!.getUTCMonth() + 1;
    const bd = c.dateOfBirth!.getUTCDate();
    if (bm === 2 && bd === 29 && !isLeapYear) return m === 2 && d === 28;
    return bm === m && bd === d;
  });

  for (const c of due) {
    const vars = { firstName: c.firstName, lastName: c.lastName };
    try {
      await sendGmailMessage({
        to: c.email!,
        subject: renderTemplate(template.subject, vars),
        body: renderTemplate(template.body, vars),
      });
      await prisma.contact.update({ where: { id: c.id }, data: { birthdayEmailYear: y } });
      await prisma.activity.create({ data: { contactId: c.id, type: "email", summary: "Birthday email sent" } });
      result.sent++;
    } catch (err) {
      result.errors.push({
        contactName: `${c.firstName} ${c.lastName}`,
        error: err instanceof Error ? err.message : "Send failed",
      });
    }
  }

  return result;
}
