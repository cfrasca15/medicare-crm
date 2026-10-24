"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PipelineStage } from "@/generated/prisma/client";
import { STAGE_ORDER } from "@/lib/constants";
import { logStageChanges } from "@/lib/activity";

function refresh() {
  revalidatePath("/contacts", "layout");
  revalidatePath("/tasks");
  revalidatePath("/");
}

// Bulk actions from the Contacts list's checkboxes.
export async function bulkSetStage(contactIds: string[], stage: string) {
  if (!contactIds.length) return { error: "Tick at least one contact." };
  if (!STAGE_ORDER.includes(stage)) return { error: "Pick a stage." };
  const before = await prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, stage: true } });
  const res = await prisma.contact.updateMany({
    where: { id: { in: contactIds } },
    data: { stage: stage as PipelineStage },
  });
  await logStageChanges(before.map((c) => ({ contactId: c.id, from: c.stage, to: stage })), "bulk change");
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
