import { prisma } from "@/lib/prisma";
import { formatDateOnly, todayInputValue } from "@/lib/date";

// Events and their guests. Guests are not contacts: they stay on the event
// (and on the follow-up list) until "Add to Contacts" or "Not interested".

export const eventLeadSource = (eventName: string) => `Event: ${eventName}`;

// Event dates are calendar dates stored at UTC midnight (see date.ts).
export const eventDateLong = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export const todayAsDate = (now = new Date()) => new Date(`${todayInputValue(now)}T00:00:00Z`);

export interface GuestCounts {
  total: number;
  rsvps: number;
  came: number;
  noShows: number;
  walkIns: number;
  unmarked: number;
}

export function guestCounts(guests: { attended: boolean | null; walkIn: boolean }[]): GuestCounts {
  return {
    total: guests.length,
    rsvps: guests.filter((g) => !g.walkIn).length,
    came: guests.filter((g) => g.attended === true).length,
    noShows: guests.filter((g) => g.attended === false).length,
    walkIns: guests.filter((g) => g.walkIn).length,
    unmarked: guests.filter((g) => g.attended === null).length,
  };
}

const digits10 = (s: string | null | undefined) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

type GuestIdentity = { firstName: string; lastName: string; email: string | null; phone: string | null };

// Finds the contact each guest already is, if any: the same full name, or the
// same first name with the same email or phone. A shared email or phone alone
// isn't enough, since couples often share one.
export async function matchGuestsToContacts(guests: GuestIdentity[]): Promise<(string | null)[]> {
  if (!guests.length) return [];
  const contacts = await prisma.contact.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, cellPhone: true },
  });
  return guests.map((g) => {
    const first = norm(g.firstName);
    const last = norm(g.lastName);
    const email = norm(g.email);
    const phone = digits10(g.phone);
    const hit = contacts.find((c) => {
      if (norm(c.firstName) !== first) return false;
      if (last && norm(c.lastName) === last) return true;
      if (email && norm(c.email) === email) return true;
      return Boolean(phone) && (digits10(c.phone) === phone || digits10(c.cellPhone) === phone);
    });
    return hit?.id ?? null;
  });
}

const logSuffix = (event: { name: string; date: Date }) => `: ${event.name} (${formatDateOnly(event.date)})`;

// Keeps the "came to / missed this event" line on a contact's timeline in
// step with the guest list. Only written once attendance is finished, so
// marking people during the event doesn't fill timelines with corrections.
export async function syncAttendanceLog(guestIds: string[]): Promise<void> {
  if (!guestIds.length) return;
  const guests = await prisma.eventGuest.findMany({
    where: { id: { in: guestIds }, contactId: { not: null } },
    include: { event: true },
  });
  for (const g of guests) {
    const suffix = logSuffix(g.event);
    await prisma.activity.deleteMany({
      where: { contactId: g.contactId!, type: "event", summary: { endsWith: suffix } },
    });
    if (g.attended === null || !g.event.attendanceDoneAt) continue;
    await prisma.activity.create({
      data: {
        contactId: g.contactId!,
        type: "event",
        summary: `${g.attended ? "Came to event" : "RSVP'd but missed event"}${suffix}`,
      },
    });
  }
}

// Takes that line back off a contact's timeline (the guest turned out to be
// someone else).
export async function removeAttendanceLog(contactId: string, event: { name: string; date: Date }): Promise<void> {
  await prisma.activity.deleteMany({
    where: { contactId, type: "event", summary: { endsWith: logSuffix(event) } },
  });
}

const pacificHour = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(d));

// The day (Pacific, yyyy-mm-dd) an event's follow-up emails go out at 9 AM:
// the morning after attendance was finished. Finishing in the small hours
// (before 3 AM) still counts as the night before.
export function emailSendDay(attendanceDoneAt: Date): string {
  const d = new Date(attendanceDoneAt.getTime() + 6 * 3_600_000);
  const day = todayInputValue(d);
  if (pacificHour(d) < 9) return day;
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

// "tomorrow at 9 AM", for the event page.
export function emailSendLabel(attendanceDoneAt: Date, now = new Date()): string {
  const day = emailSendDay(attendanceDoneAt);
  const today = todayInputValue(now);
  if (day <= today) return pacificHour(now) < 9 ? "this morning at 9 AM" : "tomorrow at 9 AM";
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (day === tomorrow.toISOString().slice(0, 10)) return "tomorrow at 9 AM";
  return `${formatDateOnly(new Date(`${day}T00:00:00Z`))} at 9 AM`;
}

// Guests still to deal with, across every event that has happened: not a
// contact yet and not marked "not interested".
export function loadFollowUps() {
  return prisma.eventGuest.findMany({
    where: { contactId: null, notInterested: false, event: { date: { lte: todayAsDate() } } },
    include: { event: { select: { id: true, name: true, date: true } } },
    orderBy: [{ event: { date: "desc" } }, { lastName: "asc" }, { firstName: "asc" }],
  });
}

export function countFollowUps() {
  return prisma.eventGuest.count({
    where: { contactId: null, notInterested: false, event: { date: { lte: todayAsDate() } } },
  });
}
