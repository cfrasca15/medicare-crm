"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { CALL_OUTCOME_LABELS } from "@/lib/activity";

// Logs a call on the contact's timeline, and optionally adds a follow-up task.
export async function logCall(contactId: string, formData: FormData) {
  const outcome = String(formData.get("outcome") ?? "");
  if (!CALL_OUTCOME_LABELS[outcome]) return { error: "Pick how the call went." };
  const note = String(formData.get("note") ?? "").trim();
  const followUp = String(formData.get("followUp") ?? "").trim();

  await prisma.activity.create({
    data: {
      contactId,
      type: "call",
      outcome,
      summary: note ? `${CALL_OUTCOME_LABELS[outcome]}: ${note}` : CALL_OUTCOME_LABELS[outcome],
    },
  });
  if (followUp) {
    await prisma.task.create({
      data: { contactId, title: note ? `Follow up: ${note}` : "Follow-up call", dueDate: new Date(followUp) },
    });
  }
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteActivity(contactId: string, activityId: string) {
  await prisma.activity.delete({ where: { id: activityId } });
  revalidatePath(`/contacts/${contactId}`);
}
