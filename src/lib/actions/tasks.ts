"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const contactId = emptyToNull(formData.get("contactId"));

  await prisma.task.create({
    data: {
      title,
      notes: emptyToNull(formData.get("notes")),
      dueDate: toDate(formData.get("dueDate")),
      contactId,
    },
  });

  revalidatePath("/tasks");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
}

export async function toggleTaskDone(taskId: string, done: boolean) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status: done ? "DONE" : "OPEN" },
  });
  revalidatePath("/tasks");
  if (task.contactId) revalidatePath(`/contacts/${task.contactId}`);
  revalidatePath("/");
}

export async function deleteTask(taskId: string) {
  const task = await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/tasks");
  if (task.contactId) revalidatePath(`/contacts/${task.contactId}`);
  revalidatePath("/");
}

function emptyToNull(value: FormDataEntryValue | null): string | undefined {
  const str = String(value ?? "").trim();
  return str.length ? str : undefined;
}

function toDate(value: FormDataEntryValue | null): Date | undefined {
  const str = String(value ?? "").trim();
  return str.length ? new Date(str) : undefined;
}
