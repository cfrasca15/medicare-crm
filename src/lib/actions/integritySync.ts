"use server";

import { prisma } from "@/lib/prisma";
import {
  getIntegrityLeads,
  pushIntegrityLeadAddress,
  pushIntegrityLeadEmail,
  pushIntegrityLeadPhone,
  searchIntegrityPharmacies,
  saveIntegrityLeadPharmacies,
  searchIntegrityProviders,
  saveIntegrityLeadProviders,
  searchIntegrityPrescriptions,
  saveIntegrityLeadPrescriptions,
  type IntegrityLeadAddressInput,
  type IntegrityPharmacySearchParams,
  type IntegrityPharmacySaveRequest,
  type IntegrityProviderSearchParams,
  type IntegrityProviderSaveRequest,
  type IntegrityPrescriptionSaveRequest,
} from "@/lib/integrity";
import { revalidatePath } from "next/cache";

export async function syncIntegrityLeads(): Promise<{
  imported: number;
  updated: number;
}> {
  const [leads, mappings] = await Promise.all([
    getIntegrityLeads(),
    prisma.integrityStageMapping.findMany(),
  ]);
  const mappingByCode = new Map(mappings.map((m) => [m.code, m]));

  let imported = 0;
  let updated = 0;

  for (const lead of leads) {
    const integrityContactId = String(lead.leadId);
    const existing = await prisma.contact.findUnique({
      where: { integrityContactId },
    });
    // Only apply the mapped pipeline stage on first import — once a broker
    // starts working a lead in the CRM, re-syncing shouldn't clobber
    // their manual stage progression.
    const mappedStage = mappingByCode.get(lead.stage)?.pipelineStage ?? undefined;

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          integrityLeadStage: lead.stage,
        },
      });
      updated++;
    } else {
      await prisma.contact.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          stage: mappedStage,
          integrityContactId,
          integrityLeadStage: lead.stage,
        },
      });
      imported++;
    }
  }

  revalidatePath("/contacts");
  revalidatePath("/");

  return { imported, updated };
}

export async function pushContactAddressToIntegrity(
  contactId: string,
  address: IntegrityLeadAddressInput
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  if (!contact.integrityContactId) {
    throw new Error("Contact isn't linked to an Integrity lead");
  }

  await pushIntegrityLeadAddress(contact.integrityContactId, address);
}

export async function pushContactEmailToIntegrity(
  contactId: string,
  email: string
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  if (!contact.integrityContactId) {
    throw new Error("Contact isn't linked to an Integrity lead");
  }

  await pushIntegrityLeadEmail(contact.integrityContactId, email);
}

export async function pushContactPhoneToIntegrity(
  contactId: string,
  phoneNumber: string
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  if (!contact.integrityContactId) {
    throw new Error("Contact isn't linked to an Integrity lead");
  }

  await pushIntegrityLeadPhone(contact.integrityContactId, phoneNumber);
}

export async function searchPharmacies(params: IntegrityPharmacySearchParams) {
  return searchIntegrityPharmacies(params);
}

export async function saveContactPharmacyToIntegrity(
  contactId: string,
  pharmacy: IntegrityPharmacySaveRequest
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  if (!contact.integrityContactId) {
    throw new Error("Contact isn't linked to an Integrity lead");
  }

  await saveIntegrityLeadPharmacies(contact.integrityContactId, [pharmacy]);
}

export async function searchProviders(params: IntegrityProviderSearchParams) {
  return searchIntegrityProviders(params);
}

export async function saveContactProviderToIntegrity(
  contactId: string,
  provider: IntegrityProviderSaveRequest
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  if (!contact.integrityContactId) {
    throw new Error("Contact isn't linked to an Integrity lead");
  }

  await saveIntegrityLeadProviders(contact.integrityContactId, [provider]);
}

export async function searchPrescriptions(params: { ndc?: string; drugName?: string }) {
  return searchIntegrityPrescriptions(params);
}

export async function saveContactPrescriptionToIntegrity(
  contactId: string,
  prescription: IntegrityPrescriptionSaveRequest
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");
  if (!contact.integrityContactId) {
    throw new Error("Contact isn't linked to an Integrity lead");
  }

  await saveIntegrityLeadPrescriptions(contact.integrityContactId, [prescription]);
}
