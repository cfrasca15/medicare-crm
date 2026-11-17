import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createEvent } from "@/lib/actions/events";
import { countFollowUps, emailSendLabel, guestCounts, todayAsDate } from "@/lib/events";
import { formatDateOnly, todayInputValue } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const [events, followUps] = await Promise.all([
    prisma.event.findMany({ include: { guests: true }, orderBy: { date: "desc" } }),
    countFollowUps(),
  ]);
  const today = todayAsDate();

  return (
    <div className="page">
      <div>
        <h1 className="text-2xl font-semibold">Events</h1>
        <p className="muted mt-1 text-sm">
          Your in-person events: who RSVP&apos;d, who showed up, and who to follow up with. Guests stay here,
          out of Contacts, until you add them.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/events" className="btn-primary">
          Events
        </Link>
        <Link href="/events/follow-ups" className="btn-secondary">
          Follow-ups{followUps ? ` (${followUps})` : ""}
        </Link>
      </div>

      <section>
        <h2 className="section-label mb-2">New event</h2>
        <form action={createEvent} className="surface flex flex-wrap items-end gap-3 p-4">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
            <span className="muted text-xs">Name</span>
            <input name="name" required placeholder="Medicare 101 at the library" className="field" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="muted text-xs">Date</span>
            <input name="date" type="date" required defaultValue={todayInputValue()} className="field" />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
            <span className="muted text-xs">Location (optional)</span>
            <input name="location" className="field" />
          </label>
          <button type="submit" className="btn-primary">
            Create event
          </button>
        </form>
      </section>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 text-right font-medium">RSVPs</th>
              <th className="px-3 py-2 text-right font-medium">Came</th>
              <th className="px-3 py-2 text-right font-medium">No-shows</th>
              <th className="px-3 py-2 text-right font-medium">Walk-ins</th>
              <th className="px-3 py-2 text-right font-medium">To follow up</th>
              <th className="px-3 py-2 font-medium">Follow-up emails</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const c = guestCounts(e.guests);
              const happened = e.date <= today;
              const toFollowUp = happened ? e.guests.filter((g) => !g.contactId && !g.notInterested).length : 0;
              const sent = e.guests.filter((g) => g.emailSentAt).length;
              const waiting = new Set(
                e.guests
                  .filter((g) => g.attended !== null && !g.emailSentAt && g.email && !g.noEmail)
                  .map((g) => `${g.attended}:${g.email!.trim().toLowerCase()}`)
              ).size;
              const emails = !happened
                ? "—"
                : !e.attendanceDoneAt
                  ? "Attendance not finished"
                  : waiting
                    ? `${waiting} going out ${emailSendLabel(e.attendanceDoneAt)}`
                    : sent
                      ? `${sent} sent`
                      : "None to send";
              return (
                <tr key={e.id} className="table-row-hover border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2">
                    <Link href={`/events/${e.id}`} className="font-medium hover:underline">
                      {e.name}
                    </Link>
                    {e.location && <div className="muted text-xs">{e.location}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateOnly(e.date)}
                    {!happened && (
                      <span className="pill ml-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        Upcoming
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.rsvps}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{happened ? c.came : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{happened ? c.noShows : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{happened ? c.walkIns : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{happened ? toFollowUp : "—"}</td>
                  <td className="muted px-3 py-2 text-xs">{emails}</td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={8} className="muted px-4 py-8 text-center">
                  No events yet. Create your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
