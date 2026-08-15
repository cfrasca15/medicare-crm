import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EditablePolicyCell } from "@/components/EditablePolicyCell";
import { Prisma } from "@/generated/prisma/client";
import { formatDateOnly, dateOnlyYear } from "@/lib/date";

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

  const where: Prisma.PolicyWhereInput = {};
  if (year) {
    const y = Number(year);
    where.effectiveDate = {
      gte: new Date(Date.UTC(y, 0, 1)),
      lt: new Date(Date.UTC(y + 1, 0, 1)),
    };
  }

  const policies = await prisma.policy.findMany({
    where,
    include: { contact: true },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Enrollments</h1>
          <p className="muted mt-1 text-sm">
            Every policy across all clients — doctor and medical group are
            editable right here, click a cell to update.
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

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Carrier</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Doctor</th>
              <th className="px-3 py-2 font-medium">Medical Group</th>
              <th className="px-3 py-2 font-medium">Effective</th>
              <th className="px-3 py-2 font-medium">Commission</th>
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
                <td className="muted px-3 py-2 whitespace-nowrap">
                  {p.commissionStatus ?? "—"}
                </td>
              </tr>
            ))}
            {policies.length === 0 && (
              <tr>
                <td colSpan={7} className="muted px-4 py-8 text-center">
                  No enrollments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
