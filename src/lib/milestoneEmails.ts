import { prisma } from "@/lib/prisma";
import { sendGmailMessage, getGoogleAccount } from "@/lib/google";

interface Milestone {
  days: number;
  field: "milestone30SentAt" | "milestone60SentAt" | "milestone90SentAt";
  templateId: "day30" | "day60" | "day90";
}

const MILESTONES: Milestone[] = [
  { days: 30, field: "milestone30SentAt", templateId: "day30" },
  { days: 60, field: "milestone60SentAt", templateId: "day60" },
  { days: 90, field: "milestone90SentAt", templateId: "day90" },
];

function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

export interface MilestoneEmailResult {
  sent: number;
  skipped: number;
  errors: { contactName: string; error: string }[];
}

// Finds every policy that has crossed a 30/60/90-day mark (from its own
// effectiveDate) and hasn't had that milestone's email sent yet, sends it,
// then marks it sent. Using "reached or passed" rather than "exactly on"
// means a missed day (server down, cron didn't fire) still gets caught on
// the next run instead of silently skipping that contact forever.
export async function runMilestoneEmailCheck(): Promise<MilestoneEmailResult> {
  const result: MilestoneEmailResult = { sent: 0, skipped: 0, errors: [] };

  const googleAccount = await getGoogleAccount();
  if (!googleAccount) {
    result.errors.push({
      contactName: "(all)",
      error: "Google account isn't connected — can't send milestone emails.",
    });
    return result;
  }

  const now = new Date();

  for (const milestone of MILESTONES) {
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - milestone.days);

    const template = await prisma.milestoneEmailTemplate.findUnique({
      where: { id: milestone.templateId },
    });
    if (!template) continue;

    const policies = await prisma.policy.findMany({
      where: {
        effectiveDate: { not: null, lte: threshold },
        [milestone.field]: null,
      },
      include: { contact: true },
    });

    for (const policy of policies) {
      const contactName = `${policy.contact.firstName} ${policy.contact.lastName}`;

      if (!policy.contact.email) {
        result.skipped++;
        continue;
      }

      const vars = {
        firstName: policy.contact.firstName,
        lastName: policy.contact.lastName,
        planName: policy.planName,
        carrier: policy.carrier,
      };

      try {
        await sendGmailMessage({
          to: policy.contact.email,
          subject: renderTemplate(template.subject, vars),
          body: renderTemplate(template.body, vars),
        });
        await prisma.policy.update({
          where: { id: policy.id },
          data: { [milestone.field]: now },
        });
        result.sent++;
      } catch (err) {
        result.errors.push({
          contactName,
          error: err instanceof Error ? err.message : "Send failed",
        });
      }
    }
  }

  return result;
}
