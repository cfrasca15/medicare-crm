"use server";

import { prisma } from "@/lib/prisma";
import { PipelineStage } from "@/generated/prisma/client";
import { STAGE_ORDER } from "@/lib/constants";
import { revalidatePath } from "next/cache";

export async function createPolicy(contactId: string, formData: FormData) {
  const carrier = String(formData.get("carrier") ?? "").trim();
  const planName = String(formData.get("planName") ?? "").trim();
  if (!carrier || !planName) {
    throw new Error("Carrier and plan name are required");
  }

  await prisma.policy.create({
    data: {
      contactId,
      carrier,
      planName,
      planType: emptyToNull(formData.get("planType")),
      policyNumber: emptyToNull(formData.get("policyNumber")),
      effectiveDate: toDate(formData.get("effectiveDate")),
      commissionStatus: emptyToNull(formData.get("commissionStatus")),
      commissionAmount: toFloat(formData.get("commissionAmount")),
      annualPremium: toFloat(formData.get("annualPremium")),
      doctor: emptyToNull(formData.get("doctor")),
      medicalGroup: emptyToNull(formData.get("medicalGroup")),
    },
  });

  // Recording a policy means an application was submitted — advance the
  // pipeline automatically so it doesn't sit at an earlier stage until
  // someone remembers to update it by hand. Never moves it backward: a
  // contact already at Enrolled/Renewal/Lost (all past this point in
  // STAGE_ORDER) is left alone.
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { stage: true },
  });
  if (contact && STAGE_ORDER.indexOf(contact.stage) < STAGE_ORDER.indexOf("APPLICATION_SUBMITTED")) {
    await prisma.contact.update({
      where: { id: contactId },
      data: { stage: "APPLICATION_SUBMITTED" as PipelineStage },
    });
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/enrollments");
  revalidatePath("/");
}

export async function updatePolicyDoctorInfo(
  contactId: string,
  policyId: string,
  data: { doctor?: string; medicalGroup?: string }
) {
  const updateData: { doctor?: string | null; medicalGroup?: string | null } = {};
  if ("doctor" in data) updateData.doctor = data.doctor?.trim() || null;
  if ("medicalGroup" in data) updateData.medicalGroup = data.medicalGroup?.trim() || null;

  await prisma.policy.update({
    where: { id: policyId },
    data: updateData,
  });

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/enrollments");
}

export async function deletePolicy(contactId: string, policyId: string) {
  await prisma.policy.delete({ where: { id: policyId } });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/enrollments");
}

function emptyToNull(value: FormDataEntryValue | null): string | undefined {
  const str = String(value ?? "").trim();
  return str.length ? str : undefined;
}

function toDate(value: FormDataEntryValue | null): Date | undefined {
  const str = String(value ?? "").trim();
  return str.length ? new Date(str) : undefined;
}

function toFloat(value: FormDataEntryValue | null): number | undefined {
  const str = String(value ?? "").trim();
  if (!str.length) return undefined;
  const num = Number.parseFloat(str);
  return Number.isNaN(num) ? undefined : num;
}
