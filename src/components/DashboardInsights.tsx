import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadChangeAlerts } from "@/lib/changeAlerts";

function startOfWeek(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d;
}

// Dashboard row: calls this week, clients hit by plan/group changes, and
// the clients who've sent the most referrals.
export async function DashboardInsights() {
  const [calls, alerts, referrers] = await Promise.all([
    prisma.activity.count({ where: { type: "call", createdAt: { gte: startOfWeek() } } }),
    loadChangeAlerts(),
    prisma.contact.groupBy({
      by: ["referredById"],
      where: { referredById: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referredById: "desc" } },
      take: 3,
    }),
  ]);
  const referrerNames = await prisma.contact.findMany({
    where: { id: { in: referrers.map((r) => r.referredById as string) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const affected =
    alerts.status === "ok" ? new Set(alerts.alerts.flatMap((a) => a.clients.map((c) => c.contactId))).size : null;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="surface p-4">
        <div className="muted text-xs font-medium">Calls logged this week</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{calls}</div>
      </div>
      <Link href="/alerts" className="surface p-4 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700">
        <div className="muted text-xs font-medium">Change alerts</div>
        {affected == null ? (
          <div className="muted mt-2 text-sm">{alerts.status === "off" ? "Not connected yet" : "Couldn't check"}</div>
        ) : (
          <>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${affected ? "text-red-600 dark:text-red-400" : ""}`}>
              {affected}
            </div>
            <div className="muted text-xs">
              {affected === 1 ? "client affected" : "clients affected"} by group or plan changes
            </div>
          </>
        )}
      </Link>
      <div className="surface p-4">
        <div className="muted text-xs font-medium">Top referrers</div>
        {referrers.length === 0 ? (
          <div className="muted mt-2 text-sm">No referrals recorded yet</div>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5 text-sm">
            {referrers.map((r) => {
              const c = referrerNames.find((n) => n.id === r.referredById);
              return (
                <li key={r.referredById} className="flex justify-between gap-2">
                  <Link href={`/contacts/${r.referredById}`} className="link truncate">
                    {c ? `${c.firstName} ${c.lastName}` : "Unknown"}
                  </Link>
                  <span className="muted tabular-nums">{r._count._all}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
