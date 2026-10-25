import Link from "next/link";
import { loadServiceRequests, isDue, type RequestFilter } from "@/lib/serviceQueries";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, STATUS_STYLE, statusLabel, updateText } from "@/lib/service";
import { formatDateOnly } from "@/lib/date";

export const dynamic = "force-dynamic";

// A moment in time as a Pacific date (formatDateOnly is for calendar dates).
const stamp = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" });

const FILTERS: { key: RequestFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

export default async function ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; category?: string }>;
}) {
  const params = await searchParams;
  const show: RequestFilter = FILTERS.some((f) => f.key === params.show) ? (params.show as RequestFilter) : "open";
  const category = SERVICE_CATEGORY_LABELS[params.category ?? ""] ? params.category : undefined;
  const requests = await loadServiceRequests(show, category);
  const qs = (extra: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ show, category, ...extra })) if (v) s.set(k, v);
    return s.toString();
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Service Requests</h1>
        <p className="muted mt-1 text-sm">
          Client issues being worked on, like ID cards, billing and network problems. Open a new one from
          the client&apos;s page; they stay here until resolved.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/service?${qs({ show: f.key })}`} className={f.key === show ? "btn-primary" : "btn-secondary"}>
            {f.label}
          </Link>
        ))}
        <form className="ml-auto flex items-center gap-2">
          <input type="hidden" name="show" value={show} />
          <select name="category" defaultValue={category ?? ""} className="field">
            <option value="">All kinds</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Filter
          </button>
        </form>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Issue</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">{show === "resolved" ? "Resolved" : "Follow up"}</th>
              <th className="px-3 py-2 font-medium">Latest update</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="table-row-hover border-t border-slate-200 align-top dark:border-slate-800">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/contacts/${r.contact.id}`} className="font-medium hover:underline">
                    {r.contact.firstName} {r.contact.lastName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div>{r.title}</div>
                  <div className="muted text-xs">
                    {SERVICE_CATEGORY_LABELS[r.category] ?? r.category}
                    {r.policy ? ` · ${r.policy.carrier} ${r.policy.planName}` : ""} · opened {stamp(r.createdAt)}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? STATUS_STYLE.open}`}>
                    {statusLabel(r)}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.status === "resolved" ? (
                    <span className="muted">{r.resolvedAt ? stamp(r.resolvedAt) : "—"}</span>
                  ) : r.followUpOn ? (
                    <span className={isDue(r.followUpOn) ? "font-medium text-red-600 dark:text-red-400" : ""}>
                      {formatDateOnly(r.followUpOn)}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="muted max-w-xs px-3 py-2 text-xs">
                  {r.updates[0] ? `${stamp(r.updates[0].createdAt)}: ${updateText(r.updates[0].summary, r.title)}` : "—"}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="muted px-4 py-8 text-center">
                  {show === "open" ? "No open service requests." : "Nothing here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
