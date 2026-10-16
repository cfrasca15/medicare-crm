import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EditablePolicyCell } from "@/components/EditablePolicyCell";
import { Prisma } from "@/generated/prisma/client";
import { formatDateOnly, dateOnlyYear } from "@/lib/date";

type EnrollmentRow = Prisma.PolicyGetPayload<{ include: { contact: true } }>;

// The 1/1 effective date this AEP is selling for: during Oct-Dec that's next
// January, otherwise the January that just passed.
function aepYear(now = new Date()): number {
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function totals(rows: EnrollmentRow[]) {
  return {
    count: rows.length,
    newClients: rows.filter((p) => p.clientType === "new").length,
    currentClients: rows.filter((p) => p.clientType === "current").length,
    commission: rows.reduce((sum, p) => sum + (p.commissionAmount ?? 0), 0),
    missingCommission: rows.filter((p) => p.commissionAmount == null).length,
  };
}

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;

  const allPolicies = await prisma.policy.findMany({
    select: { effectiveDate: true },
  });
  const years = Array.from(
    new Set(
      allPolicies
        .map((p) => (p.effectiveDate ? dateOnlyYear(p.effectiveDate) : null))
        .filter((y): y is number => y != null)
    )
  ).sort((a, b) => b - a);

  // Enrollments are plans with an effective date; a client's existing plan
  // entered as "current plan" without one isn't counted.
  const where: Prisma.PolicyWhereInput = { effectiveDate: { not: null } };
  if (year) {
    const y = Number(year);
    where.effectiveDate = {
      gte: new Date(Date.UTC(y, 0, 1)),
      lt: new Date(Date.UTC(y + 1, 0, 1)),
    };
  }

  const aep = aepYear();
  const [policies, aepPolicies] = await Promise.all([
    prisma.policy.findMany({
      where,
      include: { contact: true },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.policy.findMany({
      where: { effectiveDate: new Date(Date.UTC(aep, 0, 1)) },
      include: { contact: true },
      orderBy: [{ contact: { lastName: "asc" } }, { contact: { firstName: "asc" } }],
    }),
  ]);
  const all = totals(policies);
  const aepTotals = totals(aepPolicies);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Enrollments</h1>
          <p className="muted mt-1 text-sm">
            Enrollment counts and commission. Doctor and medical group are
            editable right in the table, click a cell to update.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2">
            <select name="year" defaultValue={year ?? ""} className="field">
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              Filter
            </button>
          </form>
          <a
            href={`/api/export/enrollments${year ? `?year=${year}` : ""}`}
            className="btn-secondary"
          >
            Export CSV
          </a>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="section-label">AEP {aep - 1} · effective 1/1/{aep}</h2>
          <p className="muted mt-1 text-sm">Every plan starting January 1, {aep}.</p>
        </div>
        <Stats t={aepTotals} />
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">New / Current</th>
                <th className="px-3 py-2 font-medium">Carrier</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 text-right font-medium">Commission</th>
              </tr>
            </thead>
            <tbody>
              {aepPolicies.map((p) => (
                <tr key={p.id} className="table-row-hover border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/contacts/${p.contact.id}`} className="font-medium hover:underline">
                      {p.contact.firstName} {p.contact.lastName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <ClientType value={p.clientType} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.carrier}</td>
                  <td className="px-3 py-2">
                    {p.planName}
                    {p.planType && <span className="muted"> ({p.planType})</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {p.commissionAmount != null ? money(p.commissionAmount) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
              {aepPolicies.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted px-4 py-6 text-center">
                    No 1/1/{aep} plans yet. Add a future plan with a January 1, {aep} effective date on a contact.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">{year ? `All ${year} enrollments` : "All enrollments"}</h2>
        <Stats t={all} />
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">New / Current</th>
                <th className="px-3 py-2 font-medium">Carrier</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Doctor</th>
                <th className="px-3 py-2 font-medium">Medical Group</th>
                <th className="px-3 py-2 font-medium">Effective</th>
                <th className="px-3 py-2 text-right font-medium">Commission</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr
                  key={p.id}
                  className="table-row-hover border-t border-slate-200 dark:border-slate-800"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/contacts/${p.contact.id}`} className="font-medium hover:underline">
                      {p.contact.firstName} {p.contact.lastName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <ClientType value={p.clientType} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.carrier}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.planName}
                    {p.planType && <span className="muted"> ({p.planType})</span>}
                  </td>
                  <td className="px-3 py-2 min-w-[10rem]">
                    <EditablePolicyCell
                      contactId={p.contact.id}
                      policyId={p.id}
                      field="doctor"
                      defaultValue={p.doctor}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[10rem]">
                    <EditablePolicyCell
                      contactId={p.contact.id}
                      policyId={p.id}
                      field="medicalGroup"
                      defaultValue={p.medicalGroup}
                    />
                  </td>
                  <td className="muted px-3 py-2 whitespace-nowrap">
                    {p.effectiveDate ? formatDateOnly(p.effectiveDate) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {p.commissionAmount != null ? money(p.commissionAmount) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
              {policies.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted px-4 py-8 text-center">
                    No enrollments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stats({ t }: { t: ReturnType<typeof totals> }) {
  const cards = [
    { label: "Enrollments", value: String(t.count) },
    { label: "New clients", value: String(t.newClients) },
    { label: "Current clients", value: String(t.currentClients) },
    {
      label: "Commission",
      value: money(t.commission),
      note: t.missingCommission ? `${t.missingCommission} without an amount` : undefined,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="surface p-4">
          <div className="muted text-xs font-medium">{c.label}</div>
          <div className="mt-1 text-2xl font-semibold">{c.value}</div>
          {c.note && <div className="muted mt-1 text-xs">{c.note}</div>}
        </div>
      ))}
    </div>
  );
}

function ClientType({ value }: { value: string | null }) {
  if (value === "new") return <span>New</span>;
  if (value === "current") return <span>Current</span>;
  return <span className="muted">—</span>;
}
