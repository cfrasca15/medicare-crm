"use server";

import { prisma } from "@/lib/prisma";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  disconnectGoogleAccount,
} from "@/lib/google";
import { revalidatePath } from "next/cache";

export async function syncTaskToGoogleCalendar(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { contact: true },
  });
  if (!task) throw new Error("Task not found");
  if (!task.dueDate) throw new Error("Task needs a due date to add to your calendar");

  const title = task.contact
    ? `${task.title} — ${task.contact.firstName} ${task.contact.lastName}`
    : task.title;

  if (task.googleEventId) {
    await updateCalendarEvent(task.googleEventId, {
      title,
      description: task.notes ?? undefined,
      date: task.dueDate,
    });
  } else {
    const event = await createCalendarEvent({
      title,
      description: task.notes ?? undefined,
      date: task.dueDate,
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { googleEventId: event.id },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  if (task.contactId) revalidatePath(`/contacts/${task.contactId}`);
}

export async function removeTaskFromGoogleCalendar(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task?.googleEventId) return;

  await deleteCalendarEvent(task.googleEventId);
  await prisma.task.update({
    where: { id: taskId },
    data: { googleEventId: null },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  if (task.contactId) revalidatePath(`/contacts/${task.contactId}`);
}

export async function disconnectGoogle(): Promise<void> {
  await disconnectGoogleAccount();
  revalidatePath("/settings/google");
}
