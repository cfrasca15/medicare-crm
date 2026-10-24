import { findDuplicates } from "@/lib/duplicates";
import { MergeGroup } from "@/components/MergeGroup";
import { STAGE_LABELS } from "@/lib/constants";
import { formatDateOnly } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const groups = await findDuplicates();

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
    </div>
  );
}
