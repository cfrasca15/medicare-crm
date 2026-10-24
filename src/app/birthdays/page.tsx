import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/constants";
import { primaryPhone } from "@/lib/phone";
import { CallButton } from "@/components/CallButton";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Birth dates are calendar dates stored at UTC midnight (see date.ts).
type Person = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  stage: string;
  phone: string | null;
  cellPhone: string | null;
  cellPreferred: boolean;
};

function todayPacific(): { y: number; m: number; d: number } {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }).split("-").map(Number);
  return { y, m: m - 1, d };
}

// Days from today to a date (both as calendar dates).
function daysUntil(y: number, m: number, d: number, today = todayPacific()): number {
  return Math.round((Date.UTC(y, m, d) - Date.UTC(today.y, today.m, today.d)) / 86_400_000);
}

export default async function BirthdaysPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const today = todayPacific();
  const month = monthParam != null && /^\d{1,2}$/.test(monthParam) ? Math.min(11, Number(monthParam)) : today.m;

  const people = (await prisma.contact.findMany({
    where: { dateOfBirth: { not: null }, stage: { not: "LOST" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      stage: true,
      phone: true,
      cellPhone: true,
      cellPreferred: true,
    },
  })) as Person[];

  const birthdays = people
    .filter((p) => p.dateOfBirth.getUTCMonth() === month)
    .sort((a, b) => a.dateOfBirth.getUTCDate() - b.dateOfBirth.getUTCDate());

  // Turning 65 within 3 months either side of today: their Initial Enrollment
  // Period runs from 3 months before the 65th birthday month to 3 months after.
  const turning65 = people
    .map((p) => {
      const y = p.dateOfBirth.getUTCFullYear() + 65;
      return { p, days: daysUntil(y, p.dateOfBirth.getUTCMonth(), p.dateOfBirth.getUTCDate(), today), y };
    })
    .filter((x) => x.days >= -92 && x.days <= 183)
    .sort((a, b) => a.days - b.days);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Birthdays &amp; Turning 65</h1>
        <p className="muted mt-1 text-sm">From the birth dates on your contacts (contacts marked Lost are left out).</p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-label">Turning 65 · last 3 months to next 6 months</h2>
        </div>
        <p className="muted -mt-2 text-sm">
          Their Initial Enrollment Period runs 3 months before to 3 months after the month they turn 65.
        </p>
        <PeopleTable
          rows={turning65.map(({ p, days, y }) => ({
            p,
            when: `${MONTHS[p.dateOfBirth.getUTCMonth()]} ${p.dateOfBirth.getUTCDate()}, ${y}`,
            note: days === 0 ? "Today" : days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : `${-days} day${days === -1 ? "" : "s"} ago`,
          }))}
          empty="No one turning 65 in this window."
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-label">Birthdays in {MONTHS[month]}</h2>
          <div className="flex gap-2 text-sm">
            <Link href={`/birthdays?month=${(month + 11) % 12}`} className="btn-secondary px-3 py-1">
              ← {MONTHS[(month + 11) % 12]}
            </Link>
            <Link href={`/birthdays?month=${(month + 1) % 12}`} className="btn-secondary px-3 py-1">
              {MONTHS[(month + 1) % 12]} →
            </Link>
          </div>
        </div>
        <PeopleTable
          rows={birthdays.map((p) => {
            const age = today.y - p.dateOfBirth.getUTCFullYear() + (month < today.m ? 1 : 0);
            return {
              p,
              when: `${MONTHS[month]} ${p.dateOfBirth.getUTCDate()}`,
              note: `turns ${age}`,
            };
          })}
          empty={`No birthdays in ${MONTHS[month]}.`}
        />
      </section>
    </div>
  );
}

function PeopleTable({ rows, empty }: { rows: { p: Person; when: string; note: string }[]; empty: string }) {
  return (
    <div className="surface overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(({ p, when, note }) => {
            const phone = primaryPhone(p);
            return (
              <tr key={p.id} className="table-row-hover border-t border-slate-200 first:border-t-0 dark:border-slate-800">
                <td className="px-4 py-2">
                  <Link href={`/contacts/${p.id}`} className="font-medium hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{when}</td>
                <td className="muted px-4 py-2 whitespace-nowrap">{note}</td>
                <td className="muted px-4 py-2 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    {phone?.number ?? "—"}
                    <CallButton phone={phone?.number ?? null} />
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[p.stage]}`}>
                    {STAGE_LABELS[p.stage]}
                  </span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className="muted px-4 py-6 text-center">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
