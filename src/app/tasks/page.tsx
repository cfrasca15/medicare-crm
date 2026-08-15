import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import { SeasonalReminderButtons } from "@/components/SeasonalReminderButtons";
import { formatDateOnly } from "@/lib/date";
import { CalendarSyncButton } from "@/components/CalendarSyncButton";
import { CalendlySyncButton } from "@/components/CalendlySyncButton";

export default async function TasksPage() {
  const [openTasks, doneTasks, contacts] = await Promise.all([
    prisma.task.findMany({
      where: { status: "OPEN" },
      orderBy: { dueDate: "asc" },
      include: { contact: true },
    }),
    prisma.task.findMany({
      where: { status: "DONE" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { contact: true },
    }),
    prisma.contact.findMany({ orderBy: { lastName: "asc" } }),
  ]);

  const now = new Date();

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Tasks</h1>

      <div className="flex flex-wrap items-center gap-3">
        <CalendlySyncButton />
        <SeasonalReminderButtons />
      </div>

      <details className="surface p-3">
        <summary className="cursor-pointer text-sm font-medium">+ Add Task</summary>
        <form action={createTask} className="mt-3 flex flex-col gap-3">
          <input name="title" placeholder="Task title" required className="field" />
          <div className="grid grid-cols-2 gap-3">
            <input name="dueDate" type="date" className="field" />
            <select name="contactId" defaultValue="" className="field">
              <option value="">No linked contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>
          <textarea name="notes" placeholder="Notes" rows={2} className="field" />
          <div>
            <button type="submit" className="btn-primary">
              Add Task
            </button>
          </div>
        </form>
      </details>

      <section>
        <h2 className="section-label mb-3">Open ({openTasks.length})</h2>
        <div className="flex flex-col gap-2">
          {openTasks.length === 0 && <p className="muted text-sm">Nothing open. Nice.</p>}
          {openTasks.map((t) => {
            const overdue = t.dueDate && t.dueDate < now;
            const deleteTaskBound = deleteTask.bind(null, t.id);
            return (
              <div key={t.id} className="surface flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <TaskCheckbox taskId={t.id} done={false} />
                  <div>
                    <div>{t.title}</div>
                    {t.contact && (
                      <Link
                        href={`/contacts/${t.contact.id}`}
                        className="muted text-xs hover:underline"
                      >
                        {t.contact.firstName} {t.contact.lastName}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {t.dueDate && (
                    <span
                      className={
                        overdue
                          ? "text-xs font-medium text-red-600 dark:text-red-400"
                          : "muted text-xs"
                      }
                    >
                      {formatDateOnly(t.dueDate)}
                    </span>
                  )}
                  {t.dueDate && (
                    <CalendarSyncButton taskId={t.id} synced={!!t.googleEventId} />
                  )}
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

      {doneTasks.length > 0 && (
        <section>
          <h2 className="section-label mb-3">Recently Completed</h2>
          <div className="flex flex-col gap-2">
            {doneTasks.map((t) => (
              <div
                key={t.id}
                className="surface muted flex items-center gap-3 px-3 py-2 text-sm"
              >
                <TaskCheckbox taskId={t.id} done={true} />
                <span className="line-through">{t.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
