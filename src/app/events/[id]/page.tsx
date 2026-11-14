import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getGoogleAccount } from "@/lib/google";
import { addGuest, updateEvent } from "@/lib/actions/events";
import { emailSendLabel, eventDateLong, guestCounts, todayAsDate } from "@/lib/events";
import { EVENT_EMAIL_LABEL } from "@/lib/eventEmails";
import { guestKey } from "@/lib/guestPaste";
import { dateInputValue, formatDateOnly, formatDateTime } from "@/lib/date";
import { SaveForm } from "@/components/SaveForm";
import { ToggleSection } from "@/components/ToggleSection";
import { EventGuestTable, type GuestRow } from "@/components/EventGuestTable";
import { EventPasteGuests } from "@/components/EventPasteGuests";
import { DeleteEventButton, EventAttendancePanel, type EmailCounts } from "@/components/EventAttendancePanel";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, googleAccount, templates] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: {
        guests: {
          include: { contact: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        },
      },
    }),
    getGoogleAccount(),
    prisma.milestoneEmailTemplate.findMany({ where: { id: { in: ["eventAttended", "eventMissed"] } } }),
  ]);
  if (!event) notFound();

  const counts = guestCounts(event.guests);
  const hasHappened = event.date <= todayAsDate();
  const on = (templateId: string) => templates.find((t) => t.id === templateId)?.enabled ?? false;

  // Before attendance is finished, anyone unmarked is counted the way
  // finishing would count them: as a no-show. Afterward, someone added late
  // and not marked yet gets nothing until they are.
  const done = Boolean(event.attendanceDoneAt);
  const canEmail = (g: (typeof event.guests)[number]) => Boolean(g.email) && !g.noEmail;
  const unsent = event.guests.filter((g) => !g.emailSentAt && !(done && g.attended === null));
  // One email per address: a couple sharing one gets a single email.
  const addresses = (came: boolean) =>
    new Set(unsent.filter((g) => (g.attended === true) === came && canEmail(g)).map((g) => g.email!.trim().toLowerCase())).size;
  const emails: EmailCounts = {
    thankYou: on("eventAttended") ? addresses(true) : 0,
    missed: on("eventMissed") ? addresses(false) : 0,
    sentThankYou: event.guests.filter((g) => g.emailSentAt && g.emailKind === "attended").length,
    sentMissed: event.guests.filter((g) => g.emailSentAt && g.emailKind === "missed").length,
    cantEmail: unsent.filter((g) => !canEmail(g)).length,
  };

  const rows: GuestRow[] = event.guests.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    email: g.email,
    phone: g.phone,
    notes: g.notes,
    walkIn: g.walkIn,
    attended: g.attended,
    noEmail: g.noEmail,
    notInterested: g.notInterested,
    contact: g.contact ? { id: g.contact.id, name: `${g.contact.firstName} ${g.contact.lastName}` } : null,
    emailSent:
      g.emailSentAt && g.emailKind
        ? `${EVENT_EMAIL_LABEL[g.emailKind] ?? "Email"} sent ${g.emailSentAt.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}`
        : null,
  }));

  const stats = [
    { label: "RSVPs", value: counts.rsvps },
    { label: "Came", value: counts.came },
    { label: "No-shows", value: counts.noShows },
    { label: "Walk-ins", value: counts.walkIns },
    { label: "Not marked", value: counts.unmarked },
  ];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/events" className="link text-sm">
          ← All events
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{event.name}</h1>
            <p className="muted mt-1 text-sm">
              {eventDateLong(event.date)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
          <Link href={`/events/${event.id}/sign-in`} className="btn-secondary">
            Print sign-in sheet
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="surface px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="muted text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <EventAttendancePanel
        eventId={event.id}
        hasHappened={hasHappened}
        guestCount={counts.total}
        unmarked={counts.unmarked}
        finishedOn={event.attendanceDoneAt ? formatDateTime(event.attendanceDoneAt) : null}
        sendLabel={emailSendLabel(event.attendanceDoneAt ?? new Date())}
        emails={emails}
        googleConnected={Boolean(googleAccount)}
      />

      <section>
        <h2 className="section-label mb-2">Guest list</h2>
        <EventGuestTable guests={rows} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="section-label mb-2">Paste RSVPs</h2>
          <div className="surface p-4">
            <EventPasteGuests eventId={event.id} existingKeys={event.guests.map(guestKey)} />
          </div>
        </div>
        <div>
          <h2 className="section-label mb-2">Add one person</h2>
          <SaveForm
            action={addGuest.bind(null, event.id)}
            submitLabel="Add to the list"
            savedLabel="Added ✓"
            resetOnSuccess
            className="surface grid grid-cols-2 gap-2 p-4"
          >
            <input name="firstName" placeholder="First name" required className="field" />
            <input name="lastName" placeholder="Last name" className="field" />
            <input name="email" type="email" placeholder="Email" className="field" />
            <input name="phone" placeholder="Phone" className="field" />
            <input name="notes" placeholder="Notes (optional)" className="field col-span-2" />
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="walkIn" defaultChecked={hasHappened} />
              Walk-in (came without an RSVP)
            </label>
          </SaveForm>
        </div>
      </section>

      <ToggleSection
        title="Event details"
        actionLabel="Edit"
        closeLabel="Close"
        form={
          <div className="surface flex flex-col gap-4 p-4">
            <SaveForm action={updateEvent.bind(null, event.id)} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input name="name" defaultValue={event.name} placeholder="Name" required className="field" />
              <input name="date" type="date" defaultValue={dateInputValue(event.date)} required className="field" />
              <input name="location" defaultValue={event.location ?? ""} placeholder="Location" className="field" />
            </SaveForm>
            <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
              <DeleteEventButton eventId={event.id} name={event.name} guestCount={counts.total} />
            </div>
          </div>
        }
      >
        <p className="muted text-sm">
          {event.name} · {formatDateOnly(event.date)}
          {event.location ? ` · ${event.location}` : ""}. The follow-up email wording is on the{" "}
          <Link href="/settings/milestone-emails" className="link">
            Milestone Emails
          </Link>{" "}
          settings page.
        </p>
      </ToggleSection>
    </div>
  );
}
