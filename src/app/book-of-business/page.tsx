import Link from "next/link";
import { groupBook, groupFamily, keyOf, loadBook, type BookView } from "@/lib/bookOfBusiness";
import { formatDateOnly } from "@/lib/date";

export const dynamic = "force-dynamic";

const VIEWS: { key: BookView; label: string }[] = [
  { key: "group", label: "By medical group" },
  { key: "plan", label: "By health plan" },
  { key: "doctor", label: "By doctor" },
];

export default async function BookOfBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; carrier?: string; group?: string; q?: string }>;
}) {
  const params = await searchParams;
  const view: BookView = VIEWS.some((v) => v.key === params.view) ? (params.view as BookView) : "group";
  const filters = { carrier: params.carrier || undefined, group: params.group || undefined, q: params.q || undefined };

  const [everything, rows] = await Promise.all([loadBook(), loadBook(filters)]);
  const sections = groupBook(rows, view);
  const clients = new Set(rows.map((r) => r.contactId)).size;

  // Dropdown choices, one per spelling-insensitive value.
  const distinct = (values: (string | null)[]) => {
    const seen = new Map<string, string>();
    for (const v of values) if (v?.trim() && !seen.has(keyOf(v))) seen.set(keyOf(v), v.trim());
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  };
  const carriers = distinct(everything.map((r) => r.carrier));
  const groups = distinct(everything.map((r) => groupFamily(r.medicalGroup)));

  const qs = (extra: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ view, ...filters, ...extra })) if (v) s.set(k, v);
    return s.toString();
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Book of Business</h1>
          <p className="muted mt-1 text-sm">
            Every client&apos;s current and upcoming plans, grouped so you can find everyone
            affected when a medical group, plan or doctor changes.
          </p>
        </div>
        <a href={`/api/export/book?${qs({})}`} className="btn-secondary">
          Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/book-of-business?${qs({ view: v.key })}`}
            className={v.key === view ? "btn-primary" : "btn-secondary"}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="view" value={view} />
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search name, plan, group or doctor"
          className="field min-w-64 flex-1"
        />
        <select name="carrier" defaultValue={filters.carrier ?? ""} className="field">
          <option value="">All carriers</option>
          {carriers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="group" defaultValue={filters.group ?? ""} className="field">
          <option value="">All medical groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        {(filters.q || filters.carrier || filters.group) && (
          <Link href={`/book-of-business?view=${view}`} className="link text-sm">
            Clear
          </Link>
        )}
      </form>

      <p className="muted -mt-3 text-sm">
        {clients} {clients === 1 ? "client" : "clients"} · {rows.length} {rows.length === 1 ? "plan" : "plans"}
      </p>

      {sections.length === 0 && (
        <p className="muted surface p-6 text-center text-sm">
          No plans match. Plans appear here once they&apos;re added under Health Plans on a contact.
        </p>
      )}

      {sections.map((s) => (
        <details key={s.title} open={sections.length <= 6} className="surface">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
            <span className="font-semibold">{s.title}</span>
            <span className="muted text-sm">
              {s.count} {s.count === 1 ? "plan" : "plans"}
            </span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            {s.subsections.map((sub) => (
              <div key={sub.title}>
                <h3 className="mb-1 text-sm font-medium">
                  {sub.title} <span className="muted font-normal">({sub.rows.length})</span>
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {sub.rows.map((r) => (
                      <tr key={r.policyId} className="table-row-hover border-t border-slate-100 dark:border-slate-800">
                        <td className="w-1/4 py-1.5 pr-3">
                          <Link href={`/contacts/${r.contactId}`} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                        </td>
                        <td className="muted w-1/6 py-1.5 pr-3 whitespace-nowrap">{r.phone ?? "—"}</td>
                        <td className="muted py-1.5 pr-3">
                          {view === "doctor"
                            ? r.medicalGroup ?? "No medical group"
                            : [
                                // Show the exact group when it's rolled up under a larger one.
                                r.medicalGroup && groupFamily(r.medicalGroup) !== r.medicalGroup.trim()
                                  ? r.medicalGroup.trim()
                                  : null,
                                r.doctor ?? "No doctor entered",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap">
                          {r.status === "future" ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              {r.effectiveDate ? `Starts ${formatDateOnly(r.effectiveDate)}` : "Future"}
                            </span>
                          ) : (
                            <span className="muted text-xs">Current</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
