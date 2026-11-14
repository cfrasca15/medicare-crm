"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatDateOnly, parseDateCell } from "@/lib/date";
import { eventLeadSource, matchGuestsToContacts, removeAttendanceLog, syncAttendanceLog } from "@/lib/events";
import { guestKey, parseGuestList } from "@/lib/guestPaste";
import { sendEventEmails } from "@/lib/eventEmails";
import type { MilestoneEmailResult } from "@/lib/milestoneEmails";

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: FormDataEntryValue | null) => text(v) || null;

function refresh(eventId?: string) {
  revalidatePath("/events");
  revalidatePath("/events/follow-ups");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

function eventFields(formData: FormData) {
  const name = text(formData.get("name"));
  const date = parseDateCell(text(formData.get("date")));
  if (!name) return { error: "Give the event a name." } as const;
  if (!date) return { error: "Pick the event's date." } as const;
  return { data: { name, date, location: orNull(formData.get("location")) } } as const;
}

export async function createEvent(formData: FormData) {
  const fields = eventFields(formData);
  // The form's own "required" boxes catch this first; nothing to show beyond that.
  if ("error" in fields) throw new Error(fields.error);
  const event = await prisma.event.create({ data: fields.data });
  refresh();
  redirect(`/events/${event.id}`);
}

export async function updateEvent(eventId: string, formData: FormData) {
  const fields = eventFields(formData);
  if ("error" in fields) return { error: fields.error };
  await prisma.event.update({ where: { id: eventId }, data: fields.data });
  refresh(eventId);
}

export async function deleteEvent(eventId: string) {
  await prisma.event.delete({ where: { id: eventId } });
  refresh();
  redirect("/events");
}

export async function addGuest(eventId: string, formData: FormData) {
  const firstName = text(formData.get("firstName"));
  const lastName = text(formData.get("lastName"));
  if (!firstName) return { error: "Add at least a first name." };

  const guest = { firstName, lastName, email: orNull(formData.get("email")), phone: orNull(formData.get("phone")) };
  const existing = await prisma.eventGuest.findMany({ where: { eventId }, select: { firstName: true, lastName: true } });
  if (existing.some((g) => guestKey(g) === guestKey(guest))) {
    return { error: `${firstName} ${lastName}`.trim() + " is already on this list." };
  }

  const walkIn = formData.get("walkIn") === "on";
  const [contactId] = await matchGuestsToContacts([guest]);
  const created = await prisma.eventGuest.create({
    data: {
      eventId,
      ...guest,
      notes: orNull(formData.get("notes")),
      walkIn,
      // A walk-in is here by definition.
      attended: walkIn ? true : null,
      contactId,
    },
  });
  await syncAttendanceLog([created.id]);
  refresh(eventId);
}

// The pasted RSVP list. People already on the list are left alone.
export async function addGuestsFromPaste(
  eventId: string,
  pasted: string
): Promise<{ added: number; skipped: number } | { error: string }> {
  const parsed = parseGuestList(pasted);
  if (!parsed.length) return { error: "Couldn't find any names in that." };

  const existing = await prisma.eventGuest.findMany({ where: { eventId }, select: { firstName: true, lastName: true } });
  const seen = new Set(existing.map(guestKey));
  const fresh = parsed.filter((g) => {
    const key = guestKey(g);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const contactIds = await matchGuestsToContacts(fresh);
  if (fresh.length) {
    await prisma.eventGuest.createMany({
      data: fresh.map((g, i) => ({ eventId, ...g, contactId: contactIds[i] })),
    });
  }
  refresh(eventId);
  return { added: fresh.length, skipped: parsed.length - fresh.length };
}

export async function updateGuest(guestId: string, formData: FormData) {
  const firstName = text(formData.get("firstName"));
  if (!firstName) return { error: "Add at least a first name." };
  const current = await prisma.eventGuest.findUnique({ where: { id: guestId } });
  if (!current) return { error: "That guest is no longer on the list." };

  const identity = {
    firstName,
    lastName: text(formData.get("lastName")),
    email: orNull(formData.get("email")),
    phone: orNull(formData.get("phone")),
  };
  // A new email or phone may show they're someone already in Contacts.
  const contactId = current.contactId ?? (await matchGuestsToContacts([identity]))[0];
  await prisma.eventGuest.update({
    where: { id: guestId },
    data: { ...identity, notes: orNull(formData.get("notes")), noEmail: formData.get("noEmail") === "on", contactId },
  });
  if (contactId && !current.contactId) await syncAttendanceLog([guestId]);
  refresh(current.eventId);
}

export async function deleteGuest(guestId: string) {
  const guest = await prisma.eventGuest.delete({ where: { id: guestId }, include: { event: true } });
  if (guest.contactId) await removeAttendanceLog(guest.contactId, guest.event);
  refresh(guest.eventId);
}

export async function setAttendance(guestId: string, attended: boolean | null) {
  const guest = await prisma.eventGuest.update({ where: { id: guestId }, data: { attended } });
  await syncAttendanceLog([guestId]);
  refresh(guest.eventId);
}

export async function setNotInterested(guestId: string, notInterested: boolean) {
  const guest = await prisma.eventGuest.update({ where: { id: guestId }, data: { notInterested } });
  refresh(guest.eventId);
}

// "Not them": the guest was matched to the wrong contact.
export async function unlinkGuestContact(guestId: string) {
  const guest = await prisma.eventGuest.findUnique({ where: { id: guestId }, include: { event: true } });
  if (!guest?.contactId) return;
  await removeAttendanceLog(guest.contactId, guest.event);
  await prisma.eventGuest.update({ where: { id: guestId }, data: { contactId: null } });
  refresh(guest.eventId);
}

// Makes the guest a contact (a new lead whose source is the event), or links
// them to the contact they already are.
export async function addGuestToContacts(guestId: string): Promise<{ contactId: string } | { error: string }> {
  const guest = await prisma.eventGuest.findUnique({ where: { id: guestId }, include: { event: true } });
  if (!guest) return { error: "That guest is no longer on the list." };
  if (guest.contactId) return { contactId: guest.contactId };

  let [contactId] = await matchGuestsToContacts([guest]);
  if (!contactId) {
    if (!guest.lastName) return { error: `Add ${guest.firstName}'s last name first (Edit).` };
    const what = `${guest.event.name} on ${formatDateOnly(guest.event.date)}`;
    const how =
      guest.attended === true
        ? `${guest.walkIn ? "Walked in at" : "Came to"} ${what}.`
        : guest.attended === false
          ? `RSVP'd for ${what} but didn't come.`
          : `RSVP'd for ${what}.`;
    const note = guest.notes ? `${how}
${guest.notes}` : how;
    const contact = await prisma.contact.create({
      data: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        leadSource: eventLeadSource(guest.event.name),
        noteEntries: { create: [{ body: note }] },
      },
    });
    contactId = contact.id;
  }

  await prisma.eventGuest.update({ where: { id: guestId }, data: { contactId, notInterested: false } });
  await syncAttendanceLog([guestId]);
  refresh(guest.eventId);
  revalidatePath("/contacts");
  return { contactId };
}

// Everyone not marked counts as a no-show, attendance goes onto the timeline
// of guests who are contacts, and the follow-up emails are set to go out the
// next morning.
export async function finishAttendance(eventId: string) {
  await prisma.eventGuest.updateMany({ where: { eventId, attended: null }, data: { attended: false } });
  await prisma.event.update({ where: { id: eventId }, data: { attendanceDoneAt: new Date() } });
  const guests = await prisma.eventGuest.findMany({ where: { eventId, contactId: { not: null } }, select: { id: true } });
  await syncAttendanceLog(guests.map((g) => g.id));
  refresh(eventId);
}

// Holds back any emails not sent yet, so attendance can be corrected.
export async function reopenAttendance(eventId: string) {
  await prisma.event.update({ where: { id: eventId }, data: { attendanceDoneAt: null } });
  refresh(eventId);
}

export async function sendEventEmailsNow(eventId: string): Promise<MilestoneEmailResult> {
  const result = await sendEventEmails({ eventId });
  refresh(eventId);
  return result;
}
