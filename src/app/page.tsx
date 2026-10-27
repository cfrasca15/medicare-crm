import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { dateInputValue, todayInputValue } from "@/lib/date";
import { getGoogleAccount, listEventsInRange, type UpcomingEvent } from "@/lib/google";
import { createTask } from "@/lib/actions/tasks";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { loadServiceRequests } from "@/lib/serviceQueries";
import { aepSeason, loadAepWorklist } from "@/lib/aep";
import { loadChangeAlerts } from "@/lib/changeAlerts";

// Always render fresh (queries the database) — without this, Next.js tries
// to statically pre-render this page at build time, which fails since no
// database is available during the Docker image build.
export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

// Stages for people who are (or were) clients, shown as their own group.
const CLIENT_STAGES = ["ENROLLED", "RETAINED", "CURRENT_CLIENT", "LOST"];
const SHORT_STAGE: Record<string, string> = {
  APPOINTMENT_SET: "Appt Set",
  APPLICATION_SUBMITTED: "Submitted",
  ENROLLED: "Enrolled",
  CURRENT_CLIENT: "Current",
};

// One appointment line: a Google Calendar event, or a Calendly booking when
// Google isn't connected.
interface Appointment {
  key: string;
  title: string;
  day: string; // yyyy-mm-dd, Pacific
  time: string | null; // null for all-day
  href: string;
  external: boolean;
}

const pacificDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const pacificTime = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "numeric", day: "numeric" });

// Calendly renames a canceled booking's calendar event "Canceled: …".
const isCanceled = (e: UpcomingEvent) => /^cancell?ed\b/i.test(e.title.trim());

export default async function DashboardPage() {
  const today = todayInputValue();
  const tomorrow = addDays(today, 1);
  const season = aepSeason();

  const [stageCounts, openTasks, googleAccount, openRequests, aep, alerts] = await Promise.all([
    prisma.contact.groupBy({ by: ["stage"], _count: { stage: true } }),
    prisma.task.findMany({
      where: { status: "OPEN" },
      orderBy: { dueDate: "asc" },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    getGoogleAccount(),
    loadServiceRequests("open"),
    season.active ? loadAepWorklist() : null,
    // During AEP the worklist's urgent count covers Change Alerts.
    season.active ? null : loadChangeAlerts(),
  ]);

  // Appointments: today, then the next week.
  let appointments: Appointment[] = [];
  let calendarError: string | null = null;
  if (googleAccount) {
    try {
      const now = Date.now();
      const events = await listEventsInRange(new Date(now - 24 * 3600 * 1000), new Date(now + 8 * 24 * 3600 * 1000));
      appointments = events
        .filter((e) => !isCanceled(e))
        .map((e) => ({
          key: e.id,
          title: e.title,
          day: e.isAllDay ? e.start : pacificDay(new Date(e.start)),
          time: e.isAllDay ? null : pacificTime(new Date(e.start)),
          href: e.htmlLink,
          external: true,
        }));
    } catch (err) {
      calendarError = err instanceof Error ? err.message : "Couldn't load calendar.";
    }
  } else {
    appointments = openTasks
      .filter((t) => t.calendlyEventUri && t.dueDate)
      .map((t) => ({
        key: t.id,
        title: t.title,
        day: pacificDay(t.dueDate!),
        time: pacificTime(t.dueDate!),
        href: t.contact ? `/contacts/${t.contact.id}` : "/tasks",
        external: false,
      }));
  }
  appointments = appointments.filter((a) => a.day >= today && a.day <= addDays(today, 7));
  const todays = appointments.filter((a) => a.day === today);
  const upcoming = appointments.filter((a) => a.day > today).slice(0, 5);

  // To do: tasks due today or tomorrow, plus service follow-ups that are due.
  // Calendly bookings are appointments, not to-dos. Task due dates are
  // calendar dates (see date.ts).
  const todos = openTasks.filter((t) => !t.calendlyEventUri);
  const dueSoon = todos.filter((t) => t.dueDate && dateInputValue(t.dueDate) >= today && dateInputValue(t.dueDate) <= tomorrow);
  const overdue = todos.filter((t) => t.dueDate && dateInputValue(t.dueDate) < today).length;
  const undated = todos.filter((t) => !t.dueDate).length;
  const serviceDue = openRequests.filter((r) => r.followUpOn && dateInputValue(r.followUpOn) <= tomorrow);

  const countByStage: Record<string, number> = {};
  for (const row of stageCounts) countByStage[row.stage] = row._count.stage;

  const affected = alerts?.status === "ok" ? new Set(alerts.alerts.flatMap((a) => a.clients.map((c) => c.contactId))).size : null;
  const pct = aep && aep.counts.total ? Math.round((aep.counts.reviewed / aep.counts.total) * 100) : 0;

  const tiles: { label: string; value: React.ReactNode; sub?: string; href: string; alert?: boolean; bar?: number }[] = [
    ...(aep
      ? [
          {
            label: `AEP ${aep.season.year} reviewed`,
            value: (
              <>
                {aep.counts.reviewed} <span className="muted text-sm font-normal">of {aep.counts.total}</span>
              </>
            ),
            sub: aep.season.started ? `${aep.season.daysLeft} days to Dec 7` : `Starts in ${aep.season.daysToStart} days`,
            href: "/aep",
            bar: pct,
          },
          { label: "Urgent AEP", value: aep.counts.urgentLeft, sub: "plan or group changes", href: "/aep?show=urgent", alert: aep.counts.urgentLeft > 0 },
        ]
      : [
          {
            label: "Change alerts",
            value: affected ?? "—",
            sub: affected == null ? (alerts?.status === "off" ? "not connected yet" : "couldn't check") : "clients affected",
            href: "/alerts",
            alert: (affected ?? 0) > 0,
          },
        ]),
    { label: "Overdue tasks", value: overdue, sub: overdue ? "past their due date" : "all caught up", href: "/tasks", alert: overdue > 0 },
    {
      label: "Service requests",
      value: openRequests.length,
      sub: serviceDue.length ? `${serviceDue.length} follow-up${serviceDue.length === 1 ? "" : "s"} due` : "open",
      href: "/service",
      alert: serviceDue.some((r) => dateInputValue(r.followUpOn!) <= today),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="muted mt-1 text-sm">
          {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className={`grid grid-cols-2 gap-3 ${tiles.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="surface flex flex-col p-4 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700"
          >
            <span className="muted text-xs font-medium">{t.label}</span>
            <span className={`mt-1 text-2xl font-semibold tabular-nums ${t.alert ? "text-red-600 dark:text-red-400" : ""}`}>
              {t.value}
            </span>
            {t.bar != null && (
              <span className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${t.bar}%` }} />
              </span>
            )}
            {t.sub && <span className="muted mt-1 text-xs">{t.sub}</span>}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Today</h2>
            {googleAccount ? (
              <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="link text-sm">
                Calendar
              </a>
            ) : (
              <Link href="/calendar" className="link text-sm">
                Calendar
              </Link>
            )}
          </div>
          <div className="surface flex flex-col p-4 text-sm">
            {calendarError ? (
              <p className="text-red-600 dark:text-red-400">{calendarError}</p>
            ) : (
              <>
                <AppointmentList items={todays} empty="No appointments today." />
                {upcoming.length > 0 && (
                  <>
                    <div className="muted mt-4 mb-1 text-xs font-medium">Next few days</div>
                    <AppointmentList items={upcoming} showDay />
                  </>
                )}
              </>
            )}
            {!googleAccount && (
              <p className="muted mt-3 text-xs">
                Showing Calendly bookings.{" "}
                <Link href="/settings/google" className="link">
                  Connect Google Calendar
                </Link>{" "}
                to see everything on your calendar.
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">To do</h2>
            <Link href="/tasks" className="link text-sm">
              All tasks
            </Link>
          </div>
          <div className="surface flex flex-col gap-3 p-4 text-sm">
            <form action={createTask} className="flex gap-2">
              <input name="title" placeholder="Quick add a task…" required aria-label="New task" className="field min-w-0 flex-1" />
              <button type="submit" className="btn-secondary">
                Add
              </button>
            </form>
            {dueSoon.length === 0 && serviceDue.length === 0 ? (
              <p className="muted">Nothing due today or tomorrow.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
                {dueSoon.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2 first:pt-0">
                    <TaskCheckbox taskId={t.id} done={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{t.title}</span>
                      {t.contact && (
                        <Link href={`/contacts/${t.contact.id}`} className="muted text-xs hover:underline">
                          {t.contact.firstName} {t.contact.lastName}
                        </Link>
                      )}
                    </span>
                    <span className="muted shrink-0 text-xs">{dateInputValue(t.dueDate!) === today ? "Today" : "Tomorrow"}</span>
                  </li>
                ))}
                {serviceDue.map((r) => {
                  const day = dateInputValue(r.followUpOn!);
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-2 first:pt-0">
                      <span className="pill shrink-0 bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">Service</span>
                      <Link href={`/contacts/${r.contact.id}`} className="min-w-0 flex-1 hover:underline">
                        <span className="block truncate">{r.title}</span>
                        <span className="muted text-xs">
                          {r.contact.firstName} {r.contact.lastName}
                        </span>
                      </Link>
                      <span className={`shrink-0 text-xs ${day < today ? "font-medium text-red-600 dark:text-red-400" : "muted"}`}>
                        {day < today ? "Overdue" : day === today ? "Today" : "Tomorrow"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {(overdue > 0 || undated > 0) && (
              <Link href="/tasks" className="muted border-t border-slate-200 pt-3 text-xs hover:underline dark:border-slate-800">
                {overdue > 0 && <span className="font-medium text-red-600 dark:text-red-400">{overdue} overdue</span>}
                {overdue > 0 && undated > 0 && " · "}
                {undated > 0 && `${undated} with no due date`}
              </Link>
            )}
          </div>
        </section>
      </div>

      <section>
        <h2 className="section-label mb-2">Pipeline</h2>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          {[
            { title: "Leads", stages: STAGE_ORDER.filter((s) => !CLIENT_STAGES.includes(s)) },
            { title: "Clients", stages: CLIENT_STAGES },
          ].map((group) => (
            <div key={group.title} className="flex flex-wrap items-center gap-1.5">
              <span className="muted mr-1 text-xs font-medium">{group.title}</span>
              {group.stages.map((stage) => (
                <Link
                  key={stage}
                  href={`/contacts?stage=${stage}`}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs transition-colors hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
                >
                  <span className="muted">{SHORT_STAGE[stage] ?? STAGE_LABELS[stage]}</span>{" "}
                  <span className="font-semibold tabular-nums">{countByStage[stage] ?? 0}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AppointmentList({ items, empty, showDay = false }: { items: Appointment[]; empty?: string; showDay?: boolean }) {
  if (!items.length) return empty ? <p className="muted">{empty}</p> : null;
  return (
    <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
      {items.map((a) => (
        <li key={a.key} className="py-2 first:pt-0 last:pb-0">
          <a
            href={a.href}
            {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="flex items-baseline justify-between gap-3 hover:underline"
          >
            <span className="min-w-0 truncate">{a.title}</span>
            <span className="muted shrink-0 text-xs tabular-nums">
              {showDay && `${weekdayLabel(a.day)} · `}
              {a.time ?? "All day"}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
