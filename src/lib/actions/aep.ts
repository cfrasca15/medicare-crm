"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { AEP_STATUS_LABELS } from "@/lib/aepStatuses";
import { logStageChanges } from "@/lib/activity";

// Sets a client's status on the AEP worklist and notes it on their timeline.
// Staying moves a Current Client to Retained, like adding next year's plan does.
export async function setAepStatus(contactId: string, year: number, status: string) {
  if (!AEP_STATUS_LABELS[status]) return { error: "Unknown status." };
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { stage: true } });
  if (!contact) return { error: "Contact not found." };

  await prisma.aepReview.upsert({
    where: { contactId_year: { contactId, year } },
    create: { contactId, year, status },
    update: { status },
  });
  await prisma.activity.create({
    data: { contactId, type: "aep", summary: `AEP ${year}: ${AEP_STATUS_LABELS[status]}` },
  });
  if (status === "staying" && contact.stage === "CURRENT_CLIENT") {
    await prisma.contact.update({ where: { id: contactId }, data: { stage: "RETAINED" } });
    await logStageChanges([{ contactId, from: contact.stage, to: "RETAINED" }], "AEP worklist");
  }

  revalidatePath("/aep");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
}
