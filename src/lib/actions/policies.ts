"use server";

import { prisma } from "@/lib/prisma";
import { PipelineStage } from "@/generated/prisma/client";
import { PRE_APPLICATION_STAGES } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { planGroup } from "@/lib/coverage";
import { todayInputValue } from "@/lib/date";
import { canonicalCarrier, canonicalPlanName } from "@/lib/carriers";
import { logStageChanges } from "@/lib/activity";

export async function createPolicy(contactId: string, formData: FormData) {
  // Standard spellings, so the same carrier or plan isn't saved two ways.
  const carrier = canonicalCarrier(String(formData.get("carrier") ?? ""));
  const planName = canonicalPlanName(carrier, String(formData.get("planName") ?? ""));
  if (!carrier || !planName) {
    return { error: "Carrier and plan name are required." };
  }
  const clientType = formData.get("clientType") === "current" ? "current" : formData.get("clientType") === "new" ? "new" : null;
  const timing = formData.get("timing") === "current" ? "current" : formData.get("timing") === "future" ? "future" : null;
  if (!clientType) return { error: "Choose New client or Current client." };
  if (!timing) return { error: "Choose Current plan or Future plan." };
  const effectiveDate = timing === "future" ? toDate(formData.get("effectiveDate")) : undefined;
  const replaces = timing === "future" && formData.get("replacesCurrent") === "on";
  if (replaces && !effectiveDate) {
    return { error: "Pick the effective date so the current plan can end the day before." };
  }

  // A future plan that replaces the current one: end the current plan(s) the
  // day before it starts, so the switch happens on its own.
  if (replaces && effectiveDate) {
    const existing = await prisma.policy.findMany({
      where: { contactId },
      select: { id: true, timing: true, effectiveDate: true, termDate: true },
    });
    const ending = existing.filter((p) => planGroup(p) === "current").map((p) => p.id);
    if (ending.length) {
      await prisma.policy.updateMany({
        where: { id: { in: ending } },
        data: { termDate: new Date(effectiveDate.getTime() - 24 * 60 * 60 * 1000) },
      });
    }
  }

  await prisma.policy.create({
    data: {
      contactId,
      carrier,
      planName,
      planType: emptyToNull(formData.get("planType")),
      effectiveDate,
      timing,
      submittedAt: timing === "future" ? toDate(formData.get("submittedAt")) ?? toDate(todayInputValue()) : undefined,
      clientType,
      commissionAmount: toFloat(formData.get("commissionAmount")),
      doctor: emptyToNull(formData.get("doctor")),
      medicalGroup: emptyToNull(formData.get("medicalGroup")),
    },
  });

  // Move the pipeline stage along so nobody has to remember to:
  // - new client: a lead moves to Application Submitted (and to Enrolled
  //   once the effective date arrives, see src/lib/stageAutomation.ts);
  // - current client, current plan: a lead becomes Current Client;
  // - current client, future plan: they've been kept, so Retained.
  // Enrolled, Lost and later stages are never moved backward.
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { stage: true },
  });
  let nextStage: PipelineStage | null = null;
  if (contact) {
    const isLead = PRE_APPLICATION_STAGES.includes(contact.stage);
    if (clientType === "new" && isLead) nextStage = "APPLICATION_SUBMITTED";
    else if (clientType === "current" && timing === "current" && isLead) nextStage = "CURRENT_CLIENT";
    else if (clientType === "current" && timing === "future" && (isLead || contact.stage === "CURRENT_CLIENT")) {
      nextStage = "RETAINED";
    }
  }
  if (nextStage && contact) {
    await prisma.contact.update({ where: { id: contactId }, data: { stage: nextStage } });
    await logStageChanges([{ contactId, from: contact.stage, to: nextStage }], "health plan added");
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

export async function updatePolicyEffectiveDate(
  contactId: string,
  policyId: string,
  formData: FormData
) {
  const raw = String(formData.get("effectiveDate") ?? "").trim();
  await prisma.policy.update({
    where: { id: policyId },
    data: { effectiveDate: raw ? new Date(raw) : null },
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/enrollments");
}

// Edits a saved plan's details (from the Edit panel on its card).
export async function updatePolicy(contactId: string, policyId: string, formData: FormData) {
  // Standard spellings, so the same carrier or plan isn't saved two ways.
  const carrier = canonicalCarrier(String(formData.get("carrier") ?? ""));
  const planName = canonicalPlanName(carrier, String(formData.get("planName") ?? ""));
  if (!carrier || !planName) return { error: "Carrier and plan name are required." };
  const clientType = String(formData.get("clientType") ?? "");
  await prisma.policy.update({
    where: { id: policyId },
    data: {
      carrier,
      planName,
      planType: emptyToNull(formData.get("planType")) ?? null,
      clientType: clientType === "new" || clientType === "current" ? clientType : null,
      commissionAmount: toFloat(formData.get("commissionAmount")) ?? null,
      doctor: emptyToNull(formData.get("doctor")) ?? null,
      medicalGroup: emptyToNull(formData.get("medicalGroup")) ?? null,
      submittedAt: toDate(formData.get("submittedAt")) ?? null,
    },
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/enrollments");
}

// Commission the carrier actually paid for a plan (Enrollments page). A
// negative amount records a chargeback. Blank clears it.
export async function updateCommissionReceived(contactId: string, policyId: string, amount: number | null) {
  const value = amount == null || Number.isNaN(amount) ? null : amount;
  await prisma.policy.update({
    where: { id: policyId },
    data: { commissionReceived: value, commissionPaidAt: value == null ? null : new Date() },
  });
  revalidatePath("/enrollments");
  revalidatePath(`/contacts/${contactId}`);
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
