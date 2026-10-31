"use server";

import { prisma } from "@/lib/prisma";
import {
  createIntegrityLead,
  IntegrityApiError,
  pushIntegrityLeadAddress,
  pushIntegrityLeadEmail,
  pushIntegrityLeadMedicareInfo,
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
import { countyFips, countyForZip, normalizeCounty } from "@/lib/county";
import { integrityLeadSource } from "@/lib/leadSource";
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
    // The same number written differently (5551234567 vs (555) 123-4567) keeps the CRM's.
    phone: lead.phone && phoneDigits(lead.phone) !== phoneDigits(existing?.phone) ? lead.phone : undefined,
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
  // Integrity's lead source fills a blank one; it never replaces one already set.
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
      ...(source && !existing.leadSource ? { leadSource: source } : {}),
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
  const result = await runIntegrityLeadSync();
  revalidatePath("/contacts");
  revalidatePath("/");
  return result;
}

// The sync itself, without revalidatePath: the scheduled run (scheduledJobs.ts)
// happens outside any request, where revalidatePath throws. Pages are dynamic,
// so they show the new data on the next visit anyway.
export async function runIntegrityLeadSync(): Promise<SyncResult> {
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

// An Integrity lead that looks like the same person as a CRM contact.
type IntegrityMatch = { leadId: string; name: string; why: string };

type MatchableContact = {
  firstName: string;
  lastName: string;
  phone: string | null;
  cellPhone: string | null;
  email: string | null;
  dateOfBirth: Date | null;
};

const phoneDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);
const ymd = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// The first of these leads that looks like this person: same phone, email,
// or name and birthday.
function findMatch(contact: MatchableContact, leads: IntegrityLead[], skip: Set<string>): IntegrityMatch | null {
  const phones = [contact.phone, contact.cellPhone].map(phoneDigits).filter((p) => p.length === 10);
  const email = contact.email?.trim().toLowerCase();
  const name = `${contact.firstName} ${contact.lastName}`.trim().toLowerCase();
  const dob = ymd(contact.dateOfBirth);

  for (const lead of leads) {
    if (skip.has(String(lead.leadId))) continue;
    const leadName = `${lead.firstName} ${lead.lastName}`.trim();
    const why = phones.includes(phoneDigits(lead.phone))
      ? "same phone"
      : email && lead.email?.trim().toLowerCase() === email
        ? "same email"
        : dob && leadName.toLowerCase() === name && ymd(lead.birthdate) === dob
          ? "same name and birthday"
          : null;
    if (why) return { leadId: String(lead.leadId), name: leadName, why };
  }
  return null;
}

// Creates this contact as a new lead in Integrity, so they show up in
// MedicareCENTER, and links the two. Checks for the same person there first
// (returned as `match`) unless createAnyway is set.
//
// The lead is made with the basics (name, birthday, phones, email, address);
// Medicare and Medi-Cal details follow through the lead update Integrity
// already accepts from the CSV import. If Integrity fails on its side (500),
// it may have made the lead anyway, so that's checked before trying again
// with just name and phone and adding the rest one piece at a time.
export async function sendContactToIntegrity(
  contactId: string,
  createAnyway = false
): Promise<{ error?: string; match?: IntegrityMatch; message?: string }> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, include: { providers: true, pharmacies: true } });
  if (!contact) return { error: "Contact not found." };
  if (contact.integrityContactId) return { error: "This contact is already linked to Integrity." };

  let message: string;
  try {
    const ignored = new Set(
      (await prisma.ignoredIntegrityLead.findMany({ select: { integrityContactId: true } })).map((r) => r.integrityContactId)
    );
    const before = await getIntegrityLeads();
    if (!createAnyway) {
      const match = findMatch(contact, before, ignored);
      if (match) {
        const linked = await prisma.contact.findUnique({
          where: { integrityContactId: match.leadId },
          select: { firstName: true, lastName: true },
        });
        if (linked) {
          return {
            error: `${match.name} (${match.why}) is already in MedicareCENTER, linked to ${linked.firstName} ${linked.lastName} here. If they're the same person, merge them on the Duplicates page.`,
          };
        }
        return { match };
      }
    }

    const phones = [
      ...new Set((contact.cellPreferred ? [contact.cellPhone, contact.phone] : [contact.phone, contact.cellPhone]).map(phoneDigits)),
    ].filter((p) => p.length === 10);
    const email = contact.email?.trim() || null;
    const address =
      contact.address && contact.city && contact.state && contact.zip
        ? {
            address1: contact.address,
            city: contact.city,
            stateCode: contact.state,
            postalCode: contact.zip,
            county: contact.county ?? undefined,
            countyFips: countyFips(contact.county),
          }
        : null;
    const basics = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      primaryCommunication: phones.length || !email ? "Phone" : "Email",
      phones: phones.map((phoneNumber) => ({ phoneNumber })),
    };

    let leadId: string;
    let stage: number | undefined;
    const missed: string[] = [];
    try {
      const lead = await createIntegrityLead({
        ...basics,
        birthDate: ymd(contact.dateOfBirth) || undefined,
        emails: email ? [{ email }] : [],
        addresses: address ? [address] : [],
      });
      leadId = String(lead.leadId ?? "");
      stage = lead.stage;
    } catch (err) {
      if (!(err instanceof IntegrityApiError) || err.status < 500) throw err;
      // Integrity usually makes the lead before failing. Look among leads that
      // weren't there before (by name too, since they're brand new), giving
      // its list a few seconds to catch up, before making another.
      const known = new Set([...ignored, ...before.map((l) => String(l.leadId))]);
      const name = `${contact.firstName} ${contact.lastName}`.trim().toLowerCase();
      let made: { leadId: string } | null = null;
      for (let attempt = 0; attempt < 4 && !made; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 2000));
        const fresh = (await getIntegrityLeads()).filter((l) => !known.has(String(l.leadId)));
        const byName = fresh.find((l) => `${l.firstName} ${l.lastName}`.trim().toLowerCase() === name);
        made = findMatch(contact, fresh, known) ?? (byName ? { leadId: String(byName.leadId) } : null);
      }
      if (made) {
        leadId = made.leadId;
      } else {
        const lead = await createIntegrityLead(basics);
        leadId = String(lead.leadId ?? "");
        stage = lead.stage;
        if (leadId && email) {
          await pushIntegrityLeadEmail(leadId, email).catch(() => missed.push("email"));
        }
        if (leadId && address) {
          await pushIntegrityLeadAddress(leadId, address).catch(() => missed.push("address"));
        }
        if (contact.dateOfBirth) missed.push("birthday");
      }
    }
    if (!leadId) throw new Error("Integrity didn't send back the new lead's ID.");

    await prisma.contact.update({
      where: { id: contactId },
      data: { integrityContactId: leadId, integrityLeadStage: stage },
    });
    await prisma.activity.create({ data: { contactId, type: "stage", summary: "Sent to MedicareCENTER (new Integrity lead)" } });

    // Medicare and Medi-Cal details, through the partial lead update.
    const medicare = {
      medicareBeneficiaryId: contact.medicareId ?? undefined,
      partA: ymd(contact.partAEffectiveDate) || undefined,
      partB: ymd(contact.partBEffectiveDate) || undefined,
      ...(contact.medicaid ? { hasMedicAid: 1 as const, medicaidId: contact.medicaidId ?? undefined } : {}),
    };
    if (Object.values(medicare).some((v) => v !== undefined)) {
      await pushIntegrityLeadMedicareInfo(leadId, medicare).catch(() => missed.push("Medicare info"));
    }

    // Doctors already on the contact go along too. Pharmacies can't: the CRM
    // doesn't keep the pharmacy NPI Integrity needs.
    const doctors = contact.providers.filter((p) => p.npi && !p.syncedToIntegrity);
    if (doctors.length) {
      try {
        await saveIntegrityLeadProviders(
          leadId,
          doctors.map((d, i) => ({ npi: d.npi!, isPrimary: i === 0 }))
        );
        await prisma.contactProvider.updateMany({
          where: { id: { in: doctors.map((d) => d.id) } },
          data: { syncedToIntegrity: true },
        });
      } catch {
        missed.push(doctors.length === 1 ? "doctor" : "doctors");
      }
    }
    if (contact.pharmacies.some((p) => !p.syncedToIntegrity)) missed.push("pharmacy");

    message =
      "Sent to MedicareCENTER ✓" +
      (doctors.length && !missed.some((m) => m.startsWith("doctor"))
        ? ` with ${doctors.length} doctor${doctors.length === 1 ? "" : "s"}`
        : "") +
      (missed.length ? `. Add there: ${missed.join(", ")}` : "");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't reach Integrity." };
  }
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  return { message };
}

// Links a contact to a lead already in Integrity (instead of making a
// duplicate), then pulls that lead's details in.
export async function linkContactToIntegrity(contactId: string, leadId: string): Promise<{ error?: string; message?: string }> {
  const [contact, taken] = await Promise.all([
    prisma.contact.findUnique({ where: { id: contactId }, select: { integrityContactId: true } }),
    prisma.contact.findUnique({ where: { integrityContactId: leadId }, select: { firstName: true, lastName: true } }),
  ]);
  if (!contact) return { error: "Contact not found." };
  if (contact.integrityContactId) return { error: "This contact is already linked to Integrity." };
  if (taken) return { error: `That lead is already linked to ${taken.firstName} ${taken.lastName}.` };

  await prisma.contact.update({ where: { id: contactId }, data: { integrityContactId: leadId } });
  await prisma.activity.create({ data: { contactId, type: "stage", summary: "Linked to their existing MedicareCENTER lead" } });
  const res = await syncIntegrityContact(contactId);
  if (res.error) return res;
  return { message: !res.message || res.message === "Already up to date ✓" ? "Linked ✓" : `Linked. ${res.message}` };
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
