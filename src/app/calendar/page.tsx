import Link from "next/link";
import { getGoogleAccount, listEventsInRange, type UpcomingEvent } from "@/lib/google";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function eventDateKey(event: UpcomingEvent): string {
  return event.isAllDay ? event.start : event.start.slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await searchParams;

  const now = new Date();
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) - 1 : now.getMonth(); // 0-indexed

  const googleAccount = await getGoogleAccount();

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()) + 1); // exclusive upper bound

  let eventsByDay = new Map<string, UpcomingEvent[]>();
  let calendarError: string | null = null;

  if (googleAccount) {
    try {
      const events = await listEventsInRange(gridStart, gridEnd);
      eventsByDay = new Map();
      for (const event of events) {
        const key = eventDateKey(event);
        const list = eventsByDay.get(key) ?? [];
        list.push(event);
        eventsByDay.set(key, list);
      }
    } catch (err) {
      calendarError = err instanceof Error ? err.message : "Couldn't load calendar.";
    }
  }

  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  while (cursor < gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const prevMonth = month === 0 ? { year: year - 1, month: 12 } : { year, month };
  const nextMonth = month === 11 ? { year: year + 1, month: 1 } : { year, month: month + 2 };
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {MONTH_NAMES[month]} {year}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?year=${prevMonth.year}&month=${prevMonth.month}`}
            className="btn-secondary px-3 py-2 text-sm"
          >
            ← Prev
          </Link>
          <Link href="/calendar" className="btn-secondary px-3 py-2 text-sm">
            Today
          </Link>
          <Link
            href={`/calendar?year=${nextMonth.year}&month=${nextMonth.month}`}
            className="btn-secondary px-3 py-2 text-sm"
          >
            Next →
          </Link>
        </div>
      </div>

      {!googleAccount && (
        <p className="muted text-sm">
          <Link href="/settings/google" className="link">
            Connect Google Calendar
          </Link>{" "}
          to see your events here.
        </p>
      )}
      {calendarError && (
        <p className="text-sm text-red-600 dark:text-red-400">{calendarError}</p>
      )}

      {googleAccount && !calendarError && (
        <div className="surface overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {WEEKDAYS.map((day) => (
              <div key={day} className="table-head px-2 py-2 text-center text-xs font-medium">
                {day}
              </div>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="grid grid-cols-7 border-b border-slate-200 last:border-b-0 dark:border-slate-800"
            >
              {week.map((day) => {
                const inMonth = day.getMonth() === month;
                const key = dateKey(day.getFullYear(), day.getMonth(), day.getDate());
                const dayEvents = eventsByDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={`min-h-[6rem] border-r border-slate-200 p-1.5 last:border-r-0 dark:border-slate-800 ${
                      inMonth ? "" : "bg-slate-50 dark:bg-slate-900/40"
                    }`}
                  >
                    <div
                      className={
                        isToday
                          ? "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white"
                          : `mb-1 text-xs font-medium ${inMonth ? "" : "muted"}`
                      }
                    >
                      {day.getDate()}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <a
                          key={event.id}
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={event.title}
                          className="truncate rounded bg-indigo-50 px-1 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                        >
                          {event.title}
                        </a>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="muted text-[11px]">+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
