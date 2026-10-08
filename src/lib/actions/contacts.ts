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

  const notes = emptyToNull(formData.get("notes"));

  const contact = await prisma.contact.create({
    data: {
      firstName,
      lastName,
      email: emptyToNull(formData.get("email")),
      phone: emptyToNull(formData.get("phone")),
      cellPhone: emptyToNull(formData.get("cellPhone")),
      address: emptyToNull(formData.get("address")),
      city: emptyToNull(formData.get("city")),
      state: emptyToNull(formData.get("state")),
      zip: emptyToNull(formData.get("zip")),
      dateOfBirth: toDate(formData.get("dateOfBirth")),
      insuranceCompany: emptyToNull(formData.get("insuranceCompany")),
      planName: emptyToNull(formData.get("planName")),
      doctor: emptyToNull(formData.get("doctor")),
      medicalGroup: emptyToNull(formData.get("medicalGroup")),
      medicareId: emptyToNull(formData.get("medicareId")),
      partAEffectiveDate: toDate(formData.get("partAEffectiveDate")),
      partBEffectiveDate: toDate(formData.get("partBEffectiveDate")),
      noteEntries: notes ? { create: [{ body: notes }] } : undefined,
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

export async function addContactNote(contactId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a note first." };

  await prisma.contactNote.create({
    data: { contactId, body },
  });
  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteContactNote(contactId: string, noteId: string) {
  await prisma.contactNote.delete({ where: { id: noteId } });
  revalidatePath(`/contacts/${contactId}`);
}

// Personal + Medicare details in one form. Blank fields are saved as empty
// (null) so clearing a field actually clears it.
export async function updateContactInfo(contactId: string, formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!firstName || !lastName) return { error: "First and last name are required." };
  const cellPhone = orNull(formData.get("cellPhone"));

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      firstName,
      lastName,
      phone: orNull(formData.get("phone")),
      cellPhone,
      cellPreferred: Boolean(cellPhone) && formData.get("cellPreferred") === "on",
      email: orNull(formData.get("email")),
      dateOfBirth: dateOrNull(formData.get("dateOfBirth")),
      address: orNull(formData.get("address")),
      city: orNull(formData.get("city")),
      state: orNull(formData.get("state")),
      zip: orNull(formData.get("zip")),
      medicareId: orNull(formData.get("medicareId")),
      partAEffectiveDate: dateOrNull(formData.get("partAEffectiveDate")),
      partBEffectiveDate: dateOrNull(formData.get("partBEffectiveDate")),
    },
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
}

// What the prospect is shopping for and who their doctor is — separate from
// each policy's own carrier/plan/doctor, which records what was sold.
export async function updateContactProspectInfo(contactId: string, formData: FormData) {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      insuranceCompany: orNull(formData.get("insuranceCompany")),
      planName: orNull(formData.get("planName")),
      doctor: orNull(formData.get("doctor")),
      medicalGroup: orNull(formData.get("medicalGroup")),
    },
  });
  revalidatePath(`/contacts/${contactId}`);
}

// The person to reach on the client's behalf. Clearing the name clears
// the "call instead" choice too, so it can't point at nobody.
export async function updateContactPerson(contactId: string, formData: FormData) {
  const name = orNull(formData.get("altContactName"));
  const phone = orNull(formData.get("altContactPhone"));
  const email = orNull(formData.get("altContactEmail"));
  if (!name && (phone || email)) return { error: "Add the contact person's name." };

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      altContactName: name,
      altContactRelationship: orNull(formData.get("altContactRelationship")),
      altContactPhone: phone,
      altContactEmail: email,
      altContactPreferred: Boolean(name) && formData.get("altContactPreferred") === "on",
    },
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
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

function orNull(value: FormDataEntryValue | null): string | null {
  return emptyToNull(value) ?? null;
}

function dateOrNull(value: FormDataEntryValue | null): Date | null {
  return toDate(value) ?? null;
}
