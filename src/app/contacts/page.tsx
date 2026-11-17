import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER, STAGE_COLORS } from "@/lib/constants";
import { contactWhere } from "@/lib/contactFilters";
import { isWebsiteSource } from "@/lib/leadSource";
import { BulkBar } from "@/components/BulkBar";
import { ContactFilters } from "@/components/ContactFilters";
import { DropdownMenu } from "@/components/DropdownMenu";
import { SyncButton } from "@/components/SyncButton";
import { WebsiteLeadsSyncButton } from "@/components/WebsiteLeadsSyncButton";
import { GoogleContactsSyncButton } from "@/components/GoogleContactsSyncButton";
import { CallButton } from "@/components/CallButton";
import { primaryPhone } from "@/lib/phone";
import { planGroup } from "@/lib/coverage";
import { formatDateOnly, monthRange } from "@/lib/date";

const PAGE_SIZE = 100;

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
    page?: string;
    all?: string;
  }>;
}) {
  const params = await searchParams;
  const { stage, q, source, flag, county, eff } = params;
  // 100 at a time keeps the page quick; "Show all" brings back the full list
  // (for ticking everyone in a filter at once).
  const showAll = params.all === "1";
  const pageNumber = Math.max(1, Math.floor(Number(params.page)) || 1);
  const where = contactWhere(params);
  const effectiveRange = monthRange(eff);

  const [contacts, total, sourceRows, countyRows] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      ...(showAll ? {} : { skip: (pageNumber - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      include: {
        policies: { select: { effectiveDate: true, termDate: true, timing: true, carrier: true, planName: true } },
      },
    }),
    prisma.contact.count({ where }),
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

  // Active filters as removable chips.
  const flagLabels: Record<string, string> = { either: "Medi-Cal or Extra Help", medicaid: "Medi-Cal", extraHelp: "Extra Help" };
  const chips = [
    q && { key: "q", label: `“${q}”` },
    stage && STAGE_LABELS[stage] && { key: "stage", label: STAGE_LABELS[stage] },
    source && {
      key: "source",
      label: source === "website" ? "Website leads" : source === "none" ? "No source" : `Source: ${source}`,
    },
    flag && flagLabels[flag] && { key: "flag", label: flagLabels[flag] },
    county && { key: "county", label: `${county} County` },
    effectiveRange && { key: "eff", label: `Effective ${formatDateOnly(effectiveRange.gte)}` },
  ].filter(Boolean) as { key: string; label: string }[];
  // The address with some settings changed (blank removes one). Changing a
  // filter always goes back to the first page.
  const withParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(
      Object.entries({ ...params, page: "", ...changes }).filter(
        (kv): kv is [string, string] => typeof kv[1] === "string" && kv[1] !== ""
      )
    ).toString();
    return next ? `/contacts?${next}` : "/contacts";
  };
  const withoutParam = (key: string) => withParams({ [key]: "" });
  const firstShown = total === 0 ? 0 : showAll ? 1 : (pageNumber - 1) * PAGE_SIZE + 1;
  const lastShown = showAll ? total : Math.min(total, (pageNumber - 1) * PAGE_SIZE + contacts.length);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SyncButton />
          <DropdownMenu label="More ▾">
            <WebsiteLeadsSyncButton className="menu-item" />
            <GoogleContactsSyncButton className="menu-item" />
            <Link href="/contacts/import" className="menu-item">
              Import CSV
            </Link>
            <a href={`/api/export/contacts${exportQuery ? `?${exportQuery}` : ""}`} className="menu-item">
              Export CSV{exportQuery ? " (this list)" : ""}
            </a>
          </DropdownMenu>
          <Link href="/contacts/new" className="btn-primary">
            + New Contact
          </Link>
        </div>
      </div>

      <ContactFilters
        stages={STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
        sources={otherSources.map((s) => ({ value: s, label: s }))}
        counties={counties}
      />

      <div className="-mt-2 flex flex-wrap items-center gap-2 text-sm">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={withoutParam(c.key)}
            className="pill gap-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300"
            title="Remove this filter"
          >
            {c.label} <span aria-hidden="true">✕</span>
          </Link>
        ))}
        {chips.length > 1 && (
          <Link href="/contacts" className="link text-xs">
            Clear all
          </Link>
        )}
        <span className="muted ml-auto">
          {total} {total === 1 ? "contact" : "contacts"}
        </span>
      </div>

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

      {total > PAGE_SIZE && (
        <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="muted">
            Showing {firstShown}–{lastShown} of {total}
          </span>
          <div className="flex items-center gap-2">
            {!showAll && pageNumber > 1 && (
              <Link href={withParams({ page: pageNumber > 2 ? String(pageNumber - 1) : "" })} className="btn-secondary px-3 py-1.5">
                ← Previous
              </Link>
            )}
            {!showAll && pageNumber < pageCount && (
              <Link href={withParams({ page: String(pageNumber + 1) })} className="btn-secondary px-3 py-1.5">
                Next →
              </Link>
            )}
            <Link href={withParams({ all: showAll ? "" : "1" })} className="link ml-2">
              {showAll ? `Show ${PAGE_SIZE} at a time` : `Show all ${total}`}
            </Link>
          </div>
        </div>
      )}
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
  const when = lastWebsiteLeadAt ? ` (latest ${lastWebsiteLeadAt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })})` : "";
  return (
    <span
      className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
      title={`${isWebsiteSource(leadSource) ? leadSource : "Website: returning contact"}${when}`}
    >
      {isWebsiteSource(leadSource) ? "Website" : "Website · returned"}
    </span>
  );
}
