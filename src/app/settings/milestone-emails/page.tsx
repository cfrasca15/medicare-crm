import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getGoogleAccount } from "@/lib/google";
import { updateMilestoneTemplate } from "@/lib/actions/milestoneEmails";
import { SendMilestoneEmailsButton } from "@/components/SendMilestoneEmailsButton";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

const MILESTONES = [
  { id: "day30" as const, label: "Day 30" },
  { id: "day60" as const, label: "Day 60" },
  { id: "day90" as const, label: "Day 90" },
];

export default async function MilestoneEmailsPage() {
  const [templates, googleAccount, recentPolicies] = await Promise.all([
    prisma.milestoneEmailTemplate.findMany(),
    getGoogleAccount(),
    prisma.policy.findMany({
      where: {
        OR: [
          { milestone30SentAt: { not: null } },
          { milestone60SentAt: { not: null } },
          { milestone90SentAt: { not: null } },
        ],
      },
      include: { contact: true },
      take: 100,
    }),
  ]);

  const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));

  const recentSends = recentPolicies
    .flatMap((p) => {
      const contactName = `${p.contact.firstName} ${p.contact.lastName}`;
      const entries: { contactId: string; contactName: string; label: string; sentAt: Date }[] = [];
      if (p.milestone30SentAt) {
        entries.push({ contactId: p.contactId, contactName, label: "Day 30", sentAt: p.milestone30SentAt });
      }
      if (p.milestone60SentAt) {
        entries.push({ contactId: p.contactId, contactName, label: "Day 60", sentAt: p.milestone60SentAt });
      }
      if (p.milestone90SentAt) {
        entries.push({ contactId: p.contactId, contactName, label: "Day 90", sentAt: p.milestone90SentAt });
      }
      return entries;
    })
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    .slice(0, 20);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">30/60/90-Day Milestone Emails</h1>
        <p className="muted mt-1 text-sm">
          Automatically checks once a day for any policy that has crossed a
          30/60/90-day mark since its effective date and hasn&apos;t gotten
          that check-in email yet. Placeholders: {"{{firstName}}"},{" "}
          {"{{lastName}}"}, {"{{planName}}"}, {"{{carrier}}"}.
        </p>
      </div>

      {!googleAccount && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
          Google isn&apos;t connected, so these emails can&apos;t send yet.
          Connect it on the{" "}
          <Link href="/settings/google" className="link">
            Google
          </Link>{" "}
          settings page.
        </div>
      )}

      <div className="surface p-4">
        <SendMilestoneEmailsButton />
      </div>

      <div className="flex flex-col gap-4">
        {MILESTONES.map((m) => {
          const template = templateById[m.id];
          const updateForContact = updateMilestoneTemplate.bind(null, m.id);
          return (
            <section key={m.id}>
              <h2 className="section-label mb-3">{m.label}</h2>
              <form action={updateForContact} className="flex flex-col gap-2">
                <input
                  name="subject"
                  defaultValue={template?.subject ?? ""}
                  placeholder="Subject"
                  required
                  className="field"
                />
                <textarea
                  name="body"
                  defaultValue={template?.body ?? ""}
                  rows={6}
                  required
                  className="field"
                />
                <div>
                  <button type="submit" className="btn-secondary">
                    Save
                  </button>
                </div>
              </form>
            </section>
          );
        })}
      </div>

      <section>
        <h2 className="section-label mb-3">Recently Sent</h2>
        {recentSends.length === 0 && (
          <p className="muted text-sm">No milestone emails have been sent yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {recentSends.map((s, i) => (
            <div
              key={i}
              className="surface flex items-center justify-between px-3 py-2 text-sm"
            >
              <Link href={`/contacts/${s.contactId}`} className="link font-medium">
                {s.contactName}
              </Link>
              <span className="muted text-xs">
                {s.label} · {formatDateTime(s.sentAt)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
