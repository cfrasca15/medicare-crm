import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CARRIER_NAMES, canonicalCarrier } from "@/lib/carriers";
import { formatDateOnly } from "@/lib/date";
import { CommissionImport } from "@/components/CommissionImport";
import { UndoStatementButton } from "@/components/UndoStatementButton";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// Plans that started 60+ days ago with an expected commission and nothing
// received: the payments to chase.
async function loadUnpaid(now = new Date()) {
  return prisma.policy.findMany({
    where: {
      effectiveDate: { lte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
      termDate: null,
      commissionAmount: { gt: 0 },
      OR: [{ commissionReceived: null }, { commissionReceived: 0 }],
      contact: { stage: { not: "LOST" } },
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ carrier: "asc" }, { effectiveDate: "asc" }],
  });
}

export default async function CommissionsPage() {
  const [statements, unpaid, usedCarriers] = await Promise.all([
    prisma.commissionStatement.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    loadUnpaid(),
    prisma.policy.findMany({ distinct: ["carrier"], select: { carrier: true } }),
  ]);
  const carriers = [...new Set([...CARRIER_NAMES, ...usedCarriers.map((p) => canonicalCarrier(p.carrier))])].sort((a, b) =>
    a.localeCompare(b)
  );
  const unpaidTotal = unpaid.reduce((s, p) => s + (p.commissionAmount ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Commissions</h1>
        <p className="muted mt-1 text-sm">
          Upload carrier commission statements to fill in what you&apos;ve been paid on each client&apos;s
          plan. Expected vs received totals are on{" "}
          <Link href="/enrollments" className="link">
            Enrollments
          </Link>
          .
        </p>
      </div>

      <CommissionImport carriers={carriers} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="section-label">Nothing received yet</h2>
          <p className="muted mt-1 text-sm">
            Plans that started over 60 days ago with an expected commission and no payment recorded.
          </p>
        </div>
        {unpaid.length === 0 ? (
          <p className="muted surface p-4 text-sm">Nothing outstanding.</p>
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Carrier</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Effective</th>
                  <th className="px-3 py-2 text-right font-medium">Expected</th>
                </tr>
              </thead>
              <tbody>
                {unpaid.map((p) => (
                  <tr key={p.id} className="table-row-hover border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={`/contacts/${p.contact.id}`} className="font-medium hover:underline">
                        {p.contact.firstName} {p.contact.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.carrier}</td>
                    <td className="px-3 py-2">{p.planName}</td>
                    <td className="muted px-3 py-2 whitespace-nowrap">{formatDateOnly(p.effectiveDate!)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{money(p.commissionAmount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-medium dark:border-slate-800">
                  <td className="px-3 py-2" colSpan={4}>
                    {unpaid.length} {unpaid.length === 1 ? "plan" : "plans"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(unpaidTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">Imported statements</h2>
        {statements.length === 0 ? (
          <p className="muted surface p-4 text-sm">No statements imported yet.</p>
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2 font-medium">Imported</th>
                  <th className="px-3 py-2 font-medium">Carrier</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 text-right font-medium">Lines</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="muted px-3 py-2 whitespace-nowrap">
                      {s.createdAt.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{s.carrier}</td>
                    <td className="px-3 py-2">{s.fileName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.lineCount}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{money(s.total)}</td>
                    <td className="px-3 py-2 text-right">
                      <UndoStatementButton id={s.id} label={`the ${s.carrier} statement ${s.fileName}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
