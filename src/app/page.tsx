import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER, STAGE_COLORS } from "@/lib/constants";
import { formatDateOnly } from "@/lib/date";
import { getGoogleAccount, listUpcomingEvents, type UpcomingEvent } from "@/lib/google";

export default async function DashboardPage() {
  const [stageCounts, openTasks, recentContacts, googleAccount] = await Promise.all([
    prisma.contact.groupBy({ by: ["stage"], _count: { stage: true } }),
    prisma.task.findMany({
      where: { status: "OPEN" },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { contact: true },
    }),
    prisma.contact.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getGoogleAccount(),
  ]);

  let calendarEvents: UpcomingEvent[] = [];
  let calendarError: string | null = null;
  if (googleAccount) {
    try {
      calendarEvents = await listUpcomingEvents(5);
    } catch (err) {
      calendarError = err instanceof Error ? err.message : "Couldn't load calendar.";
    }
  }

  const countByStage: Record<string, number> = {};
  for (const row of stageCounts) countByStage[row.stage] = row._count.stage;

  const now = new Date();
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < now);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="muted mt-1 text-sm">Pipeline overview and upcoming follow-ups.</p>
      </div>

      <section>
        <h2 className="section-label mb-3">Pipeline</h2>
        <div className="grid grid-cols-4 gap-3">
          {STAGE_ORDER.map((stage) => (
            <Link
              key={stage}
              href={`/contacts?stage=${stage}`}
              className="surface p-4 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700"
            >
              <div className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[stage]}`}>
                {STAGE_LABELS[stage]}
              </div>
              <div className="text-2xl font-semibold">{countByStage[stage] ?? 0}</div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Google Calendar</h2>
            {googleAccount && (
              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="link text-sm"
              >
                Open
              </a>
            )}
          </div>
          {!googleAccount ? (
            <p className="muted text-sm">
              <Link href="/settings/google" className="link">
                Connect Google Calendar
              </Link>{" "}
              to see upcoming events here.
            </p>
          ) : calendarError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{calendarError}</p>
          ) : calendarEvents.length === 0 ? (
            <p className="muted text-sm">No upcoming events.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {calendarEvents.map((event) => (
                <li key={event.id}>
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="surface flex items-center justify-between px-3 py-2 text-sm transition-colors hover:border-indigo-300 dark:hover:border-indigo-700"
                  >
                    <span className="font-medium">{event.title}</span>
                    <span className="muted text-xs whitespace-nowrap">
                      {event.isAllDay
                        ? formatDateOnly(new Date(event.start))
                        : new Date(event.start).toLocaleString(undefined, {
                            month: "numeric",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Upcoming Tasks</h2>
            <Link href="/tasks" className="link text-sm">
              View all
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <p className="muted text-sm">No open tasks.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {openTasks.map((task) => (
                <li
                  key={task.id}
                  className="surface flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{task.title}</div>
                    {task.contact && (
                      <Link
                        href={`/contacts/${task.contact.id}`}
                        className="muted hover:underline"
                      >
                        {task.contact.firstName} {task.contact.lastName}
                      </Link>
                    )}
                  </div>
                  {task.dueDate && (
                    <span
                      className={
                        overdue.includes(task)
                          ? "text-xs font-medium text-red-600 dark:text-red-400"
                          : "muted text-xs"
                      }
                    >
                      {formatDateOnly(task.dueDate)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Recent Contacts</h2>
            <Link href="/contacts" className="link text-sm">
              View all
            </Link>
          </div>
          {recentContacts.length === 0 ? (
            <p className="muted text-sm">No contacts yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentContacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contacts/${c.id}`}
                    className="surface flex items-center justify-between px-3 py-2 text-sm transition-colors hover:border-indigo-300 dark:hover:border-indigo-700"
                  >
                    <span className="font-medium">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[c.stage]}`}>
                      {STAGE_LABELS[c.stage]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
