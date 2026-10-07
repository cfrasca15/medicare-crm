import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER, STAGE_COLORS } from "@/lib/constants";
import { PipelineStage, Prisma } from "@/generated/prisma/client";
import { SyncButton } from "@/components/SyncButton";
import { WebsiteLeadsSyncButton } from "@/components/WebsiteLeadsSyncButton";
import { CallButton } from "@/components/CallButton";
import { coverageMonth, currentPolicy } from "@/lib/coverage";
import { formatDateOnly, monthRange } from "@/lib/date";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string; source?: string; eff?: string }>;
}) {
  const { stage, q, source, eff } = await searchParams;

  const where: Prisma.ContactWhereInput = {};
  if (stage && STAGE_ORDER.includes(stage)) {
    where.stage = stage as PipelineStage;
  }
  if (source === "website") {
    where.AND = [
      { OR: [{ leadSource: { startsWith: "Website" } }, { lastWebsiteLeadAt: { not: null } }] },
    ];
  }
  const effectiveRange = monthRange(eff);
  if (effectiveRange) {
    where.policies = { some: { effectiveDate: effectiveRange } };
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
    include: { policies: { select: { effectiveDate: true, carrier: true, planName: true } } },
  });

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex items-center gap-3">
          <WebsiteLeadsSyncButton />
          <SyncButton />
          <a
            href={(() => {
              const params = new URLSearchParams({
                ...(stage ? { stage } : {}),
                ...(q ? { q } : {}),
                ...(source ? { source } : {}),
                ...(effectiveRange && eff ? { eff } : {}),
              });
              const qs = params.toString();
              return `/api/export/contacts${qs ? `?${qs}` : ""}`;
            })()}
            className="btn-secondary"
          >
            Export CSV
          </a>
          <Link href="/contacts/import" className="btn-secondary">
            Import CSV
          </Link>
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
        <select name="source" defaultValue={source ?? ""} className="field">
          <option value="">All sources</option>
          <option value="website">Website leads</option>
        </select>
        <label className="muted flex items-center gap-2 text-sm whitespace-nowrap">
          Effective
          <input
            type="month"
            name="eff"
            defaultValue={effectiveRange ? eff : ""}
            title="Only contacts with a policy starting in this month"
            className="field"
          />
        </label>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <p className="muted -mt-3 text-sm">
        {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
        {stage && STAGE_LABELS[stage] ? ` · ${STAGE_LABELS[stage]}` : ""}
        {effectiveRange ? ` · effective ${formatDateOnly(effectiveRange.gte)}` : ""}
      </p>

      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Effective</th>
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
                  <WebsiteBadge leadSource={c.leadSource} lastWebsiteLeadAt={c.lastWebsiteLeadAt} />
                </td>
                <td className="muted px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span>{c.phone ?? "—"}</span>
                    <CallButton phone={c.phone} />
                  </div>
                </td>
                <td className="muted px-4 py-2">{c.email ?? "—"}</td>
                <td className="px-4 py-2">
                  <EffectiveCell policy={currentPolicy(c.policies)} />
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[c.stage]}`}>
                    {STAGE_LABELS[c.stage]}
                  </span>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="muted px-4 py-8 text-center">
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

function EffectiveCell({
  policy,
}: {
  policy: { effectiveDate: Date | null; carrier: string; planName: string } | null;
}) {
  if (!policy?.effectiveDate) return <span className="muted">—</span>;
  const month = coverageMonth(policy.effectiveDate);
  return (
    <div className="flex flex-col" title={`${policy.carrier} ${policy.planName}`}>
      <span>{formatDateOnly(policy.effectiveDate)}</span>
      <span className="muted text-xs">{month === null ? "Not started" : `Month ${month}`}</span>
    </div>
  );
}

function WebsiteBadge({
  leadSource,
  lastWebsiteLeadAt,
}: {
  leadSource: string | null;
  lastWebsiteLeadAt: Date | null;
}) {
  if (!leadSource && !lastWebsiteLeadAt) return null;
  const when = lastWebsiteLeadAt ? ` (latest ${lastWebsiteLeadAt.toLocaleDateString("en-US")})` : "";
  return (
    <span
      className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
      title={`${leadSource ?? "Website: returning contact"}${when}`}
    >
      {leadSource ? "Website" : "Website · returned"}
    </span>
  );
}
