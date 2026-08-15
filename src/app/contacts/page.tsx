import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER, STAGE_COLORS } from "@/lib/constants";
import { PipelineStage, Prisma } from "@/generated/prisma/client";
import { SyncButton } from "@/components/SyncButton";
import { CallButton } from "@/components/CallButton";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string }>;
}) {
  const { stage, q } = await searchParams;

  const where: Prisma.ContactWhereInput = {};
  if (stage && STAGE_ORDER.includes(stage)) {
    where.stage = stage as PipelineStage;
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex items-center gap-3">
          <SyncButton />
          <a
            href={(() => {
              const params = new URLSearchParams({
                ...(stage ? { stage } : {}),
                ...(q ? { q } : {}),
              });
              const qs = params.toString();
              return `/api/export/contacts${qs ? `?${qs}` : ""}`;
            })()}
            className="btn-secondary"
          >
            Export CSV
          </a>
          <Link href="/contacts/new" className="btn-primary">
            + New Contact
          </Link>
        </div>
      </div>

      <form className="flex items-center gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, or phone"
          className="field flex-1"
        />
        <select name="stage" defaultValue={stage ?? ""} className="field">
          <option value="">All stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Stage</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr
                key={c.id}
                className="table-row-hover border-t border-slate-200 dark:border-slate-800"
              >
                <td className="px-4 py-2">
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                </td>
                <td className="muted px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span>{c.phone ?? "—"}</span>
                    <CallButton phone={c.phone} />
                  </div>
                </td>
                <td className="muted px-4 py-2">{c.email ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[c.stage]}`}>
                    {STAGE_LABELS[c.stage]}
                  </span>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={4} className="muted px-4 py-8 text-center">
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
