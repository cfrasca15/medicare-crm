import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isWebsiteSource } from "@/lib/leadSource";
import { todayInputValue } from "@/lib/date";

export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "all", label: "All time" },
  { key: "year", label: "This year" },
  { key: "month", label: "This month" },
] as const;
type Period = (typeof PERIODS)[number]["key"];

const CLIENT_STAGES: string[] = ["ENROLLED", "RETAINED", "CURRENT_CLIENT"];

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Midnight Pacific on the first of this year or month.
function periodStart(period: Period): Date | undefined {
  if (period === "all") return undefined;
  const today = todayInputValue();
  const first = period === "year" ? `${today.slice(0, 4)}-01-01` : `${today.slice(0, 7)}-01`;
  return new Date(`${first}T00:00:00-08:00`);
}

interface SourceRow {
  label: string;
  filter: string; // the Contacts page's source filter for this row
  leads: number;
  inProgress: number;
  clients: number;
  lost: number;
  paid: number;
}

export default async function LeadSourcesPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams;
  const period: Period = PERIODS.some((p) => p.key === params.period) ? (params.period as Period) : "all";

  const contacts = await prisma.contact.findMany({
    where: { createdAt: { gte: periodStart(period) } },
    select: {
      stage: true,
      leadSource: true,
      lastWebsiteLeadAt: true,
      policies: { select: { commissionReceived: true } },
    },
  });

  const bySource = new Map<string, SourceRow>();
  for (const c of contacts) {
    // Each contact counts once, under the source that first brought them in.
    const website = isWebsiteSource(c.leadSource) || (!c.leadSource && c.lastWebsiteLeadAt);
    const label = website ? "Website" : (c.leadSource ?? "No source");
    const row = bySource.get(label) ?? {
      label,
      filter: website ? "website" : (c.leadSource ?? "none"),
      leads: 0,
      inProgress: 0,
      clients: 0,
      lost: 0,
      paid: 0,
    };
    row.leads++;
    if (c.stage === "LOST") row.lost++;
    else if (CLIENT_STAGES.includes(c.stage)) row.clients++;
    else row.inProgress++;
    row.paid += c.policies.reduce((sum, p) => sum + (p.commissionReceived ?? 0), 0);
    bySource.set(label, row);
  }

  const rows = [...bySource.values()].sort(
    (a, b) =>
      Number(a.filter === "none") - Number(b.filter === "none") || b.leads - a.leads || a.label.localeCompare(b.label)
  );
  const total = (pick: (r: SourceRow) => number) => rows.reduce((sum, r) => sum + pick(r), 0);
  const rate = (clients: number, leads: number) => (leads ? `${Math.round((clients / leads) * 100)}%` : "—");

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Lead Sources</h1>
        <p className="muted mt-1 text-sm">
          Where your contacts came from and how many became clients (Enrolled, Retained or Current Client). Click a
          source to see its contacts. Time periods go by the day a contact was added to the CRM.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/lead-sources?period=${p.key}`} className={p.key === period ? "btn-primary" : "btn-secondary"}>
            {p.label}
          </Link>
        ))}
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-2 py-2 sm:px-3 font-medium">Source</th>
              <th className="px-2 py-2 sm:px-3 text-right font-medium">Leads</th>
              <th className="hidden px-2 py-2 sm:px-3 text-right font-medium sm:table-cell">In progress</th>
              <th className="px-2 py-2 sm:px-3 text-right font-medium">Clients</th>
              <th className="hidden px-2 py-2 sm:px-3 text-right font-medium sm:table-cell">Lost</th>
              <th className="px-2 py-2 sm:px-3 text-right font-medium">
                <span className="sm:hidden">Rate</span>
                <span className="hidden sm:inline">Client rate</span>
              </th>
              <th className="px-2 py-2 sm:px-3 text-right font-medium">
                <span className="sm:hidden">Paid</span>
                <span className="hidden sm:inline">Commission paid</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="table-row-hover border-t border-slate-200 dark:border-slate-800">
                <td className="px-2 py-2 sm:px-3">
                  <Link href={`/contacts?source=${encodeURIComponent(r.filter)}`} className="font-medium hover:underline">
                    {r.label}
                  </Link>
                </td>
                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{r.leads}</td>
                <td className="hidden px-2 py-2 sm:px-3 text-right tabular-nums sm:table-cell">{r.inProgress}</td>
                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{r.clients}</td>
                <td className="hidden px-2 py-2 sm:px-3 text-right tabular-nums sm:table-cell">{r.lost}</td>
                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{rate(r.clients, r.leads)}</td>
                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{money(r.paid)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted px-4 py-8 text-center">
                  No contacts were added in this period.
                </td>
              </tr>
            )}
            {rows.length > 0 && (
              <tr className="border-t border-slate-200 font-medium dark:border-slate-800">
                <td className="px-2 py-2 sm:px-3">Total</td>
                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{total((r) => r.leads)}</td>
                <td className="hidden px-2 py-2 sm:px-3 text-right tabular-nums sm:table-cell">{total((r) => r.inProgress)}</td>
                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{total((r) => r.clients)}</td>
                <td className="hidden px-2 py-2 sm:px-3 text-right tabular-nums sm:table-cell">{total((r) => r.lost)}</td>
                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{rate(total((r) => r.clients), total((r) => r.leads))}</td>
                <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{money(total((r) => r.paid))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
