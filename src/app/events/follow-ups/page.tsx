import Link from "next/link";
import { loadFollowUps } from "@/lib/events";
import { formatDateOnly } from "@/lib/date";
import { CallButton } from "@/components/CallButton";
import { EventFollowUpButtons } from "@/components/EventFollowUpButtons";

export const dynamic = "force-dynamic";

export default async function EventFollowUpsPage() {
  const guests = await loadFollowUps();

  return (
    <div className="page">
      <div>
        <h1 className="text-2xl font-semibold">Event follow-ups</h1>
        <p className="muted mt-1 text-sm">
          Everyone from past events who isn&apos;t in Contacts yet. Once you&apos;ve spoken, add them to
          Contacts or mark them not interested, and they leave this list.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/events" className="btn-secondary">
          Events
        </Link>
        <Link href="/events/follow-ups" className="btn-primary">
          Follow-ups{guests.length ? ` (${guests.length})` : ""}
        </Link>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Showed up?</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id} className="table-row-hover border-t border-slate-200 align-top dark:border-slate-800">
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {g.firstName} {g.lastName}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {g.phone ? (
                    <span className="flex items-center gap-2">
                      {g.phone} <CallButton phone={g.phone} />
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2">{g.email ?? <span className="muted">—</span>}</td>
                <td className="px-3 py-2">
                  <Link href={`/events/${g.event.id}`} className="hover:underline">
                    {g.event.name}
                  </Link>
                  <div className="muted text-xs">{formatDateOnly(g.event.date)}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {g.attended === true ? (
                    <span className="pill bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {g.walkIn ? "Came (walk-in)" : "Came"}
                    </span>
                  ) : g.attended === false ? (
                    <span className="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">No-show</span>
                  ) : (
                    <span className="muted text-xs">Not marked</span>
                  )}
                </td>
                <td className="muted max-w-xs px-3 py-2 text-xs whitespace-pre-wrap">{g.notes ?? ""}</td>
                <td className="px-3 py-2">
                  <EventFollowUpButtons guestId={g.id} contact={null} notInterested={false} />
                </td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr>
                <td colSpan={7} className="muted px-4 py-8 text-center">
                  Nobody waiting on a follow-up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
