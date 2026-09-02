"use server";

import { prisma } from "@/lib/prisma";
import { PipelineStage } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createContact(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!firstName || !lastName) {
    throw new Error("First and last name are required");
  }

  const contact = await prisma.contact.create({
    data: {
      firstName,
      lastName,
      email: emptyToNull(formData.get("email")),
      phone: emptyToNull(formData.get("phone")),
      address: emptyToNull(formData.get("address")),
      city: emptyToNull(formData.get("city")),
      state: emptyToNull(formData.get("state")),
      zip: emptyToNull(formData.get("zip")),
      dateOfBirth: toDate(formData.get("dateOfBirth")),
      notes: emptyToNull(formData.get("notes")),
      doctor: emptyToNull(formData.get("doctor")),
      medicalGroup: emptyToNull(formData.get("medicalGroup")),
      medicareId: emptyToNull(formData.get("medicareId")),
      partAEffectiveDate: toDate(formData.get("partAEffectiveDate")),
      partBEffectiveDate: toDate(formData.get("partBEffectiveDate")),
    },
  });

  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function updateContactStage(contactId: string, stage: PipelineStage) {
  await prisma.contact.update({
    where: { id: contactId },
    data: { stage },
  });
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
}

export async function updateContactNotes(contactId: string, formData: FormData) {
  const notes = String(formData.get("notes") ?? "");
  await prisma.contact.update({
    where: { id: contactId },
    data: { notes },
  });
  revalidatePath(`/contacts/${contactId}`);
}

export async function updateContactDoctorInfo(contactId: string, formData: FormData) {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      doctor: emptyToNull(formData.get("doctor")),
      medicalGroup: emptyToNull(formData.get("medicalGroup")),
    },
  });
  revalidatePath(`/contacts/${contactId}`);
}

export async function updateContactMedicareInfo(contactId: string, formData: FormData) {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      medicareId: emptyToNull(formData.get("medicareId")),
      partAEffectiveDate: toDate(formData.get("partAEffectiveDate")),
      partBEffectiveDate: toDate(formData.get("partBEffectiveDate")),
    },
  });
  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteContact(contactId: string) {
  await prisma.contact.delete({ where: { id: contactId } });
  revalidatePath("/contacts");
  redirect("/contacts");
}

function emptyToNull(value: FormDataEntryValue | null): string | undefined {
  const str = String(value ?? "").trim();
  return str.length ? str : undefined;
}

function toDate(value: FormDataEntryValue | null): Date | undefined {
  const str = String(value ?? "").trim();
  return str.length ? new Date(str) : undefined;
}
