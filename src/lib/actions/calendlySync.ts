"use server";

import { prisma } from "@/lib/prisma";
import { listUpcomingCalendlyEvents, listEventInvitees } from "@/lib/calendly";
import { revalidatePath } from "next/cache";

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function syncCalendlyEvents(): Promise<{
  tasksCreated: number;
  contactsCreated: number;
  skipped: number;
}> {
  const events = await listUpcomingCalendlyEvents(90);

  let tasksCreated = 0;
  let contactsCreated = 0;
  let skipped = 0;

  for (const event of events) {
    const invitees = await listEventInvitees(event.uri);

    for (const invitee of invitees) {
      const existingTask = await prisma.task.findFirst({
        where: { calendlyEventUri: event.uri },
      });
      if (existingTask) {
        skipped++;
        continue;
      }

      let contactId: string | undefined;
      if (invitee.email) {
        const existingContact = await prisma.contact.findFirst({
          where: { email: invitee.email },
        });
        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const { firstName, lastName } = splitName(invitee.name);
          const newContact = await prisma.contact.create({
            data: {
              firstName,
              lastName,
              email: invitee.email,
              stage: "APPOINTMENT_SET",
            },
          });
          contactId = newContact.id;
          contactsCreated++;
        }
      }

      const notesLines: string[] = [];
      if (event.location) notesLines.push(`Location: ${event.location}`);
      for (const qa of invitee.questionsAndAnswers) {
        if (qa.answer) notesLines.push(`${qa.question}: ${qa.answer}`);
      }

      await prisma.task.create({
        data: {
          contactId,
          title: `${event.name} — ${invitee.name}`,
          notes: notesLines.length ? notesLines.join("\n") : undefined,
          dueDate: new Date(event.startTime),
          calendlyEventUri: event.uri,
        },
      });
      tasksCreated++;
    }
  }

  revalidatePath("/tasks");
  revalidatePath("/contacts");
  revalidatePath("/");

  return { tasksCreated, contactsCreated, skipped };
}
