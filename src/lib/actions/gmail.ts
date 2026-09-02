"use server";

import { prisma } from "@/lib/prisma";
import { sendGmailMessage } from "@/lib/google";
import { revalidatePath } from "next/cache";

export async function sendContactEmail(contactId: string, formData: FormData): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  if (!contact.email) throw new Error("This contact has no email address");

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) throw new Error("Subject and message are required");

  await sendGmailMessage({ to: contact.email, subject, body });
  revalidatePath(`/contacts/${contactId}`);
}
