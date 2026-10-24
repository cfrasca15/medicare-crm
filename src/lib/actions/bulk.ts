"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PipelineStage } from "@/generated/prisma/client";
import { STAGE_ORDER } from "@/lib/constants";

function refresh() {
  revalidatePath("/contacts", "layout");
  revalidatePath("/tasks");
  revalidatePath("/");
}

// Bulk actions from the Contacts list's checkboxes.
export async function bulkSetStage(contactIds: string[], stage: string) {
  if (!contactIds.length) return { error: "Tick at least one contact." };
  if (!STAGE_ORDER.includes(stage)) return { error: "Pick a stage." };
  const res = await prisma.contact.updateMany({
    where: { id: { in: contactIds } },
    data: { stage: stage as PipelineStage },
  });
  refresh();
  return { count: res.count };
}

export async function bulkAddTask(contactIds: string[], title: string, dueDate: string) {
  if (!contactIds.length) return { error: "Tick at least one contact." };
  const t = title.trim();
  if (!t) return { error: "Enter the task." };
  const due = dueDate ? new Date(dueDate) : null;
  const res = await prisma.task.createMany({
    data: contactIds.map((contactId) => ({ contactId, title: t, dueDate: due })),
  });
  refresh();
  return { count: res.count };
}
