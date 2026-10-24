import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER, STAGE_COLORS } from "@/lib/constants";
import { contactWhere } from "@/lib/contactFilters";
import { isWebsiteSource } from "@/lib/leadSource";
import { BulkBar } from "@/components/BulkBar";
import { SyncButton } from "@/components/SyncButton";
import { WebsiteLeadsSyncButton } from "@/components/WebsiteLeadsSyncButton";
import { CallButton } from "@/components/CallButton";
import { primaryPhone } from "@/lib/phone";
import { planGroup } from "@/lib/coverage";
import { formatDateOnly, monthRange } from "@/lib/date";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    stage?: string;
    q?: string;
    source?: string;
    flag?: string;
    county?: string;
    eff?: string;
  }>;
}) {
  const params = await searchParams;
  const { stage, q, source, flag, county, eff } = params;
  const effectiveRange = monthRange(eff);

  const [contacts, sourceRows, countyRows] = await Promise.all([
    prisma.contact.findMany({
      where: contactWhere(params),
      orderBy: { lastName: "asc" },
      include: {
        policies: { select: { effectiveDate: true, termDate: true, timing: true, carrier: true, planName: true } },
      },
    }),
    prisma.contact.findMany({ distinct: ["leadSource"], select: { leadSource: true }, where: { leadSource: { not: null } } }),
    prisma.contact.findMany({ distinct: ["county"], select: { county: true }, where: { county: { not: null } } }),
  ]);
  const otherSources = sourceRows
    .map((r) => r.leadSource as string)
    .filter((s) => !isWebsiteSource(s))
    .sort((a, b) => a.localeCompare(b));
  const counties = countyRows.map((r) => r.county as string).sort((a, b) => a.localeCompare(b));
  const exportQuery = new URLSearchParams(
    Object.entries({ stage, q, source, flag, county, eff: effectiveRange ? eff : undefined }).filter(
      (kv): kv is [string, string] => Boolean(kv[1])
    )
  ).toString();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex flex-wrap items-center gap-2">
          <WebsiteLeadsSyncButton />
          <SyncButton />
          <a href={`/api/export/contacts${exportQuery ? `?${exportQuery}` : ""}`} className="btn-secondary">
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

      <form className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, or phone"
          className="field min-w-64 flex-1"
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
          {otherSources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="flag" defaultValue={flag ?? ""} className="field">
          <option value="">Medi-Cal / Extra Help: any</option>
          <option value="either">Medi-Cal or Extra Help</option>
          <option value="medicaid">Medi-Cal</option>
          <option value="extraHelp">Extra Help</option>
        </select>
        <select name="county" defaultValue={county ?? ""} className="field">
          <option value="">All counties</option>
          {counties.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
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

      <BulkBar stages={STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} />

      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="w-8 px-4 py-2">
                <input type="checkbox" data-bulk-all aria-label="Select all" className="h-4 w-4 accent-indigo-600" />
              </th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Plan</th>
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
                  <input
                    type="checkbox"
                    data-bulk-id={c.id}
                    aria-label={`Select ${c.firstName} ${c.lastName}`}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </td>
                <td className="px-4 py-2">
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  <WebsiteBadge leadSource={c.leadSource} lastWebsiteLeadAt={c.lastWebsiteLeadAt} />
                  {(c.medicaid || c.extraHelp) && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                      {[c.medicaid && "Medi-Cal", c.extraHelp && "Extra Help"].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </td>
                <td className="muted px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span>
                      {primaryPhone(c)?.isCell ? "Cell " : ""}
                      {primaryPhone(c)?.number ?? "—"}
                    </span>
                    <CallButton phone={primaryPhone(c)?.number ?? null} />
                  </div>
                  {c.altContactName && c.altContactPreferred && (
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                      <span>
                        Call {c.altContactName}
                        {c.altContactRelationship ? ` (${c.altContactRelationship})` : ""}
                        {c.altContactPhone ? `: ${c.altContactPhone}` : ""}
                      </span>
                      <CallButton phone={c.altContactPhone} />
                    </div>
                  )}
                </td>
                <td className="muted px-4 py-2">{c.email ?? "—"}</td>
                <td className="px-4 py-2">
                  <PlanCell policies={c.policies} />
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
                <td colSpan={6} className="muted px-4 py-8 text-center">
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

type ListPolicy = {
  effectiveDate: Date | null;
  termDate: Date | null;
  timing: string | null;
  carrier: string;
  planName: string;
};

// The client's current plan, plus the plan they're switching to if there is one.
function PlanCell({ policies }: { policies: ListPolicy[] }) {
  const current = policies.filter((p) => planGroup(p) === "current");
  const future = policies.filter((p) => planGroup(p) === "future");
  if (!current.length && !future.length) return <span className="muted">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {current.map((p, i) => (
        <span key={`c${i}`}>
          <span className="font-medium">{p.carrier}</span> <span className="muted">{p.planName}</span>
        </span>
      ))}
      {future.map((p, i) => (
        <span key={`f${i}`} className="text-xs text-emerald-700 dark:text-emerald-300">
          {p.effectiveDate ? `Starting ${formatDateOnly(p.effectiveDate)}` : "Next"}: {p.carrier} {p.planName}
        </span>
      ))}
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
  if (!isWebsiteSource(leadSource) && !lastWebsiteLeadAt) return null;
  const when = lastWebsiteLeadAt ? ` (latest ${lastWebsiteLeadAt.toLocaleDateString("en-US")})` : "";
  return (
    <span
      className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
      title={`${isWebsiteSource(leadSource) ? leadSource : "Website: returning contact"}${when}`}
    >
      {isWebsiteSource(leadSource) ? "Website" : "Website · returned"}
    </span>
  );
}
