import { prisma } from "@/lib/prisma";
import { findDuplicates } from "@/lib/duplicates";
import { getIntegrityLeads, type IntegrityLead } from "@/lib/integrity";
import { MergeGroup } from "@/components/MergeGroup";
import { RestoreIntegrityLeadButton } from "@/components/RestoreIntegrityLeadButton";
import { STAGE_LABELS } from "@/lib/constants";
import { formatDateOnly, formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const [groups, skipped] = await Promise.all([
    findDuplicates(),
    prisma.ignoredIntegrityLead.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  // Names come from Integrity; without them the list still shows the IDs.
  let leads = new Map<string, IntegrityLead>();
  if (skipped.length) {
    try {
      leads = new Map((await getIntegrityLeads()).map((l) => [String(l.leadId), l]));
    } catch {}
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Duplicates</h1>
        <p className="muted mt-1 text-sm">
          Contacts that share a phone number, email or name. Merging keeps one contact, moves the
          others&apos; plans, tasks, notes and calls onto it, fills in any details it&apos;s missing, then
          deletes the others. The most complete contact is picked to keep by default.
        </p>
      </div>

      {groups.length === 0 && <p className="muted surface p-6 text-center text-sm">No duplicates found.</p>}

      {groups.map((g) => (
        <MergeGroup
          key={g.contacts.map((c) => c.id).join("|")}
          reasons={g.reasons}
          rows={g.contacts.map((c) => ({
            id: c.id,
            name: c.name,
            firstName: c.firstName,
            detail: [
              STAGE_LABELS[c.stage],
              c.phone,
              c.email,
              c.dateOfBirth ? `born ${formatDateOnly(c.dateOfBirth)}` : null,
              `${c.plans} plan${c.plans === 1 ? "" : "s"}`,
              `${c.notes} note${c.notes === 1 ? "" : "s"}`,
              c.integrityLinked ? "Integrity" : c.leadSource,
              `added ${formatDateOnly(c.createdAt)}`,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      ))}

      {skipped.length > 0 && (
        <section id="skipped-integrity" className="surface flex flex-col gap-3 p-4 text-sm">
          <div>
            <h2 className="font-semibold">Integrity leads left out of syncs</h2>
            <p className="muted mt-1">
              When a merged duplicate had its own Integrity lead, that lead stops syncing so it doesn&apos;t come
              back as a copy. Bring one back to make it its own contact again. Anything that moved over in the
              merge (notes, plans, tasks) stays on the contact it was merged into.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            {skipped.map((s) => {
              const lead = leads.get(s.integrityContactId);
              const name = lead ? `${lead.firstName} ${lead.lastName}`.trim() : `Integrity lead ${s.integrityContactId}`;
              return (
                <li key={s.integrityContactId} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="muted text-xs">
                      {[lead?.phone, s.reason, formatDateTime(s.createdAt)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <RestoreIntegrityLeadButton leadId={s.integrityContactId} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
