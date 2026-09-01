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
  type IntegrityLeadAddressInput,
  type IntegrityPharmacySearchParams,
  type IntegrityPharmacySearchItem,
  type IntegrityProviderSearchParams,
  type IntegrityProviderSearchItem,
  type IntegrityDrug,
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

    // Auto-fill the stage mapping's label from Integrity's own status name
    // the first time we see a given code, so Chris doesn't have to guess
    // what each numeric code means — he can still assign it a local
    // pipeline stage manually afterward via /settings/integrity-stages.
    if (!mappingByCode.has(lead.stage) && lead.stageName) {
      const created = await prisma.integrityStageMapping.create({
        data: { code: lead.stage, label: lead.stageName },
      });
      mappingByCode.set(lead.stage, created);
    }

    // Only apply the mapped pipeline stage on first import — once a broker
    // starts working a lead in the CRM, re-syncing shouldn't clobber
    // their manual stage progression.
    const mappedStage = mappingByCode.get(lead.stage)?.pipelineStage ?? undefined;

    const sharedFields = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      address: lead.address1 ?? undefined,
      city: lead.city ?? undefined,
      state: lead.stateCode ?? undefined,
      zip: lead.postalCode ?? undefined,
      dateOfBirth: lead.birthdate ? new Date(lead.birthdate) : undefined,
      medicareId: lead.medicareBeneficiaryId ?? undefined,
      integrityLeadStage: lead.stage,
    };

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: sharedFields,
      });
      updated++;
    } else {
      await prisma.contact.create({
        data: {
          ...sharedFields,
          stage: mappedStage,
          integrityContactId,
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

// Integrity's save endpoints are POST-only — there's no way to read back what's
// already on a lead (confirmed via a live 405 on the read side), so every
// pharmacy/provider/prescription added here is also kept in our own database.
// The Integrity push is best-effort: if the contact isn't linked yet, or the
// push fails, the local record is still saved so it shows up in the CRM.
export async function addContactPharmacy(
  contactId: string,
  pharmacy: IntegrityPharmacySearchItem
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");

  let syncedToIntegrity = false;
  if (contact.integrityContactId) {
    try {
      await saveIntegrityLeadPharmacies(contact.integrityContactId, [
        {
          pharmacyId: pharmacy.pharmacyNpi,
          isMailOrder: false,
          isPrimary: true,
          name: pharmacy.name,
          address1: pharmacy.address1,
          address2: pharmacy.address2 || undefined,
          city: pharmacy.city,
          zip: pharmacy.zip,
          state: pharmacy.state,
          pharmacyPhone: pharmacy.pharmacyPhone,
          isDigital: pharmacy.isDigital,
        },
      ]);
      syncedToIntegrity = true;
    } catch {
      // fall through — still keep the local record
    }
  }

  await prisma.contactPharmacy.create({
    data: {
      contactId,
      name: pharmacy.name,
      address1: pharmacy.address1,
      city: pharmacy.city,
      state: pharmacy.state,
      zip: pharmacy.zip,
      phone: pharmacy.pharmacyPhone,
      syncedToIntegrity,
    },
  });

  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteContactPharmacy(contactId: string, id: string): Promise<void> {
  await prisma.contactPharmacy.delete({ where: { id } });
  revalidatePath(`/contacts/${contactId}`);
}

export async function searchProviders(params: IntegrityProviderSearchParams) {
  return searchIntegrityProviders(params);
}

export async function addContactProvider(
  contactId: string,
  provider: IntegrityProviderSearchItem
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");

  const address = provider.addresses?.[0];

  let syncedToIntegrity = false;
  if (contact.integrityContactId) {
    try {
      await saveIntegrityLeadProviders(contact.integrityContactId, [
        {
          npi: String(provider.npi),
          addressId: address?.id,
          isPrimary: true,
        },
      ]);
      syncedToIntegrity = true;
    } catch {
      // fall through — still keep the local record
    }
  }

  await prisma.contactProvider.create({
    data: {
      contactId,
      npi: String(provider.npi),
      name: provider.presentationName,
      specialty: provider.specialty,
      address1: address?.streetLine1,
      city: address?.city,
      state: address?.state,
      zip: address?.zipCode,
      phone: provider.phone ?? address?.phoneNumbers?.[0],
      syncedToIntegrity,
    },
  });

  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteContactProvider(contactId: string, id: string): Promise<void> {
  await prisma.contactProvider.delete({ where: { id } });
  revalidatePath(`/contacts/${contactId}`);
}

export async function searchPrescriptions(params: { ndc?: string; drugName?: string }) {
  return searchIntegrityPrescriptions(params);
}

// Integrity's prescription save requires a dosageId, but its dosage catalog
// comes back empty/null for every drug in production (confirmed with
// Integrity support) — so this is local-only tracking, no push attempt.
export async function addContactPrescription(
  contactId: string,
  drug: IntegrityDrug,
  details?: { dosage?: string; quantity?: string }
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");

  await prisma.contactPrescription.create({
    data: {
      contactId,
      drugName: drug.drugName,
      chemicalName: drug.chemicalName,
      dosage: details?.dosage || undefined,
      quantity: details?.quantity || undefined,
    },
  });

  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteContactPrescription(contactId: string, id: string): Promise<void> {
  await prisma.contactPrescription.delete({ where: { id } });
  revalidatePath(`/contacts/${contactId}`);
}
