import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import { SeasonalReminderButtons } from "@/components/SeasonalReminderButtons";
import { dateInputValue, formatDateOnly, todayInputValue } from "@/lib/date";
import { CalendarSyncButton } from "@/components/CalendarSyncButton";
import { CalendlySyncButton } from "@/components/CalendlySyncButton";

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

type OpenTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  googleEventId: string | null;
  calendlyEventUri: string | null;
  contact: { id: string; firstName: string; lastName: string } | null;
};

// The day a task falls on, yyyy-mm-dd. A due date is a calendar date (see
// date.ts); a Calendly booking is a real moment, read in Pacific time.
const taskDay = (t: OpenTask) =>
  t.calendlyEventUri ? t.dueDate!.toLocaleDateString("en-CA", { timeZone: TZ }) : dateInputValue(t.dueDate!);

export default async function TasksPage() {
  const contactName = { select: { id: true, firstName: true, lastName: true } };
  const [openTasks, doneTasks, contacts] = await Promise.all([
    prisma.task.findMany({
      where: { status: "OPEN" },
      orderBy: { dueDate: "asc" },
      select: { id: true, title: true, dueDate: true, googleEventId: true, calendlyEventUri: true, contact: contactName },
    }),
    prisma.task.findMany({
      where: { status: "DONE" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, title: true },
    }),
    // Just the names, for the "link a contact" picker.
    prisma.contact.findMany({ orderBy: { lastName: "asc" }, ...contactName }),
  ]);

  const today = todayInputValue();
  const dated = openTasks.filter((t) => t.dueDate);
  const groups: { title: string; tone?: "late"; tasks: OpenTask[] }[] = [
    { title: "Overdue", tone: "late" as const, tasks: dated.filter((t) => taskDay(t) < today) },
    { title: "Today", tasks: dated.filter((t) => taskDay(t) === today) },
    { title: "Upcoming", tasks: dated.filter((t) => taskDay(t) > today) },
    { title: "No date", tasks: openTasks.filter((t) => !t.dueDate) },
  ].filter((g) => g.tasks.length > 0);

  return (
    <div className="page-narrow">
      <h1 className="text-2xl font-semibold">Tasks</h1>

      <form action={createTask} className="surface flex flex-col gap-3 p-3">
        <div className="flex flex-wrap gap-2">
          <input name="title" placeholder="Add a task…" required aria-label="New task" className="field min-w-48 flex-1" />
          <input name="dueDate" type="date" aria-label="Due date" title="Due date" className="field" />
          <button type="submit" className="btn-primary">
            Add
          </button>
        </div>
        <details>
          <summary className="link cursor-pointer text-xs font-medium">Link a contact or add notes</summary>
          <div className="mt-3 flex flex-col gap-3">
            <select name="contactId" defaultValue="" aria-label="Linked contact" className="field">
              <option value="">No linked contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
            <textarea name="notes" placeholder="Notes" rows={2} aria-label="Notes" className="field" />
          </div>
        </details>
      </form>

      {groups.length === 0 && <p className="muted text-sm">Nothing open. Nice.</p>}

      {groups.map((group) => (
        <section key={group.title}>
          <h2
            className={`section-label mb-3 ${group.tone === "late" ? "text-red-600 dark:text-red-400" : ""}`}
          >
            {group.title} ({group.tasks.length})
          </h2>
          <div className="flex flex-col gap-2">
            {group.tasks.map((t) => {
              const deleteTaskBound = deleteTask.bind(null, t.id);
              return (
                <div key={t.id} className="surface flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <TaskCheckbox taskId={t.id} done={false} />
                    <div className="min-w-0">
                      <div>{t.title}</div>
                      {t.contact && (
                        <Link href={`/contacts/${t.contact.id}`} className="muted text-xs hover:underline">
                          {t.contact.firstName} {t.contact.lastName}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {t.dueDate && (
                      <span
                        className={
                          group.tone === "late" ? "text-xs font-medium text-red-600 dark:text-red-400" : "muted text-xs"
                        }
                      >
                        {formatDateOnly(t.dueDate)}
                      </span>
                    )}
                    {t.dueDate && <CalendarSyncButton taskId={t.id} synced={!!t.googleEventId} />}
                    <form action={deleteTaskBound}>
                      <button type="submit" className="btn-danger-text text-xs">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {doneTasks.length > 0 && (
        <details>
          <summary className="section-label cursor-pointer">Recently completed ({doneTasks.length})</summary>
          <div className="mt-3 flex flex-col gap-2">
            {doneTasks.map((t) => (
              <div key={t.id} className="surface muted flex items-center gap-3 px-3 py-2 text-sm">
                <TaskCheckbox taskId={t.id} done={true} />
                <span className="line-through">{t.title}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <section>
        <h2 className="section-label mb-3">Tools</h2>
        <div className="flex flex-wrap items-center gap-3">
          <CalendlySyncButton />
          <SeasonalReminderButtons />
        </div>
      </section>
    </div>
  );
}
