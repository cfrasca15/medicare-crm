"use server";

import { prisma } from "@/lib/prisma";
import {
  getIntegrityLead,
  getIntegrityLeads,
  type IntegrityLead,
  searchIntegrityPharmacies,
  saveIntegrityLeadPharmacies,
  searchIntegrityProviders,
  saveIntegrityLeadProviders,
  searchIntegrityPrescriptions,
  type IntegrityPharmacySearchParams,
  type IntegrityPharmacySearchItem,
  type IntegrityProviderSearchParams,
  type IntegrityProviderSearchItem,
  type IntegrityDrug,
} from "@/lib/integrity";
import { revalidatePath } from "next/cache";
import type { PipelineStage } from "@/generated/prisma/client";
import { countyForZip, normalizeCounty } from "@/lib/county";
import { integrityLeadSource, isWebsiteSource } from "@/lib/leadSource";
import { logStageChanges } from "@/lib/activity";
import { STAGE_LABELS } from "@/lib/constants";

// The CRM stage a newly seen Integrity status starts mapped to (changeable on
// the Integrity Stages page). Statuses not listed start at New Lead.
const DEFAULT_STAGE_FOR_STATUS: Record<string, PipelineStage | undefined> = {
  Contacted: "CONTACTED",
  Engaged: "ENGAGED",
  Client: "CURRENT_CLIENT",
  Lost: "LOST",
  Deceased: "LOST",
};

type StageMappings = Map<number, { code: number; label: string; pipelineStage: PipelineStage | null }>;

// What a sync changed on one contact, in words for the result message.
const DETAIL_LABELS: Record<string, string> = {
  firstName: "name",
  lastName: "name",
  email: "email",
  phone: "phone",
  address: "address",
  city: "address",
  state: "address",
  zip: "address",
  dateOfBirth: "birthday",
  medicareId: "Medicare ID",
  partAEffectiveDate: "Part A date",
  partBEffectiveDate: "Part B date",
  integrityLeadStage: "Integrity status",
  county: "county",
  medicaid: "Medi-Cal",
  leadSource: "lead source",
};

function changedDetails(existing: Record<string, unknown>, data: Record<string, unknown>): string[] {
  const changed = new Set<string>();
  for (const [key, value] of Object.entries(data)) {
    const label = DETAIL_LABELS[key];
    if (value === undefined || !label) continue;
    const current = existing[key];
    const same =
      value instanceof Date ? current instanceof Date && current.getTime() === value.getTime() : current === value;
    if (!same) changed.add(label);
  }
  return [...changed];
}

type LeadResult =
  | { kind: "imported"; id: string; name: string }
  | { kind: "updated"; id: string; name: string; details: string[]; movedTo?: PipelineStage };

export interface SyncResult {
  imported: { id: string; name: string }[];
  moved: { id: string; name: string; to: string }[];
  changed: { id: string; name: string; details: string[] }[];
  unchanged: number;
}

// Creates or updates the CRM contact for one Integrity lead.
async function applyLead(lead: IntegrityLead, mappingByCode: StageMappings): Promise<LeadResult> {
  const integrityContactId = String(lead.leadId);
  const existing = await prisma.contact.findUnique({
    where: { integrityContactId },
  });

  // Auto-fill the stage mapping's label from Integrity's own status name
  // the first time we see a given code, so Chris doesn't have to guess
  // what each numeric code means — he can still assign it a local
  // pipeline stage manually afterward via /settings/integrity-stages.
  if (!mappingByCode.has(lead.stage) && lead.stageName) {
    // Integrity's "Lost" stage arrives from its API as "Other".
    const label = lead.stageName === "Other" ? "Lost" : lead.stageName;
    const created = await prisma.integrityStageMapping.create({
      data: { code: lead.stage, label, pipelineStage: DEFAULT_STAGE_FOR_STATUS[label] },
    });
    mappingByCode.set(lead.stage, created);
  }

  // The mapped pipeline stage applies on first import, whenever the lead's
  // status changes in Integrity (e.g. marked Lost there), and to anyone still
  // sitting at New Lead (e.g. already a Client in Integrity before that status
  // had a stage). A re-sync with the same Integrity status never touches a
  // stage changed by hand in the CRM.
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
    partAEffectiveDate: lead.partAEffectiveDate ? new Date(lead.partAEffectiveDate) : undefined,
    partBEffectiveDate: lead.partBEffectiveDate ? new Date(lead.partBEffectiveDate) : undefined,
    integrityLeadStage: lead.stage,
    county: normalizeCounty(lead.county) ?? countyForZip(lead.postalCode) ?? undefined,
    // Only ever turned on from Integrity, so a box ticked in the CRM stays.
    ...(lead.hasMedicaid ? { medicaid: true } : {}),
  };
  // Integrity's lead source, unless the website already set one.
  const source = integrityLeadSource(lead.leadSourceName);
  const name = `${lead.firstName} ${lead.lastName}`.trim();

  if (existing) {
    const statusChanged = existing.integrityLeadStage != null && existing.integrityLeadStage !== lead.stage;
    const moveTo =
      mappedStage && mappedStage !== existing.stage && (statusChanged || existing.stage === "NEW_LEAD")
        ? mappedStage
        : undefined;
    const data = {
      ...sharedFields,
      ...(source && !isWebsiteSource(existing.leadSource) ? { leadSource: source } : {}),
    };
    const details = changedDetails(existing, data);
    await prisma.contact.update({
      where: { id: existing.id },
      data: { ...data, ...(moveTo ? { stage: moveTo } : {}) },
    });
    if (moveTo) {
      await logStageChanges(
        [{ contactId: existing.id, from: existing.stage, to: moveTo }],
        statusChanged ? "Integrity status changed" : "Matched Integrity status"
      );
    }
    return { kind: "updated", id: existing.id, name, details, movedTo: moveTo };
  }
  const created = await prisma.contact.create({
    data: {
      ...sharedFields,
      stage: mappedStage,
      integrityContactId,
      leadSource: source ?? undefined,
    },
  });
  return { kind: "imported", id: created.id, name };
}

async function loadMappings(): Promise<StageMappings> {
  const mappings = await prisma.integrityStageMapping.findMany();
  return new Map(mappings.map((m) => [m.code, m]));
}

export async function syncIntegrityLeads(): Promise<SyncResult> {
  const [leads, mappingByCode, ignoredRows] = await Promise.all([
    getIntegrityLeads(),
    loadMappings(),
    prisma.ignoredIntegrityLead.findMany({ select: { integrityContactId: true } }),
  ]);
  const ignored = new Set(ignoredRows.map((r) => r.integrityContactId));

  const result: SyncResult = { imported: [], moved: [], changed: [], unchanged: 0 };
  for (const lead of leads) {
    if (ignored.has(String(lead.leadId))) continue;
    const r = await applyLead(lead, mappingByCode);
    if (r.kind === "imported") {
      result.imported.push({ id: r.id, name: r.name });
      continue;
    }
    if (r.movedTo) result.moved.push({ id: r.id, name: r.name, to: STAGE_LABELS[r.movedTo] ?? r.movedTo });
    // A stage move already says the Integrity status changed.
    const details = r.movedTo ? r.details.filter((d) => d !== "Integrity status") : r.details;
    if (details.length) result.changed.push({ id: r.id, name: r.name, details });
    if (!r.movedTo && !details.length) result.unchanged++;
  }

  revalidatePath("/contacts");
  revalidatePath("/");

  return result;
}

// Refreshes one contact from Integrity (the button on the contact page).
export async function syncIntegrityContact(contactId: string): Promise<{ error?: string; message?: string }> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { integrityContactId: true },
  });
  if (!contact?.integrityContactId) return { error: "This contact isn't linked to Integrity." };
  let message: string;
  try {
    const [lead, mappingByCode] = await Promise.all([getIntegrityLead(contact.integrityContactId), loadMappings()]);
    if (!lead) return { error: "Integrity has no lead with this contact's ID any more." };
    const r = await applyLead(lead, mappingByCode);
    const details = r.kind === "updated" ? r.details.filter((d) => !r.movedTo || d !== "Integrity status") : [];
    const moved = r.kind === "updated" && r.movedTo ? `Moved to ${STAGE_LABELS[r.movedTo] ?? r.movedTo}` : null;
    const updated = details.length ? `${moved ? "updated" : "Updated"} ${details.join(", ")}` : null;
    message = moved || updated ? `${[moved, updated].filter(Boolean).join("; ")} ✓` : "Already up to date ✓";
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't reach Integrity." };
  }
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  return { message };
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
