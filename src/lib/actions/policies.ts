"use server";

import { prisma } from "@/lib/prisma";
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

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/enrollments");
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
