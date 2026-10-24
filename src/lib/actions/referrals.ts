"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Records who referred a contact (null clears it). A contact with no lead
// source gets "Referral" as its source.
export async function setReferredBy(contactId: string, referrerId: string | null) {
  if (referrerId === contactId) return { error: "A contact can't refer themselves." };
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { leadSource: true } });
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      referredById: referrerId,
      ...(referrerId && !contact?.leadSource ? { leadSource: "Referral" } : {}),
    },
  });
  revalidatePath(`/contacts/${contactId}`);
  if (referrerId) revalidatePath(`/contacts/${referrerId}`);
  revalidatePath("/");
}
