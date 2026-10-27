"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Fields copied from a duplicate when the kept contact has them blank.
const FILLABLE = [
  "email", "phone", "cellPhone", "address", "city", "state", "zip", "county",
  "mailingAddress", "mailingCity", "mailingState", "mailingZip", "dateOfBirth", "medicareId", "medicaidId",
  "partAEffectiveDate", "partBEffectiveDate", "insuranceCompany", "planName", "doctor", "medicalGroup",
  "leadSource", "lastWebsiteLeadAt", "altContactName", "altContactRelationship", "altContactPhone",
  "altContactEmail", "spouseId", "referredById",
] as const;

// Merges duplicates into one contact: their plans, tasks, notes, calls and
// history move over, blank details are filled in, and the duplicates are
// deleted. A duplicate's Integrity lead is kept off future syncs if the kept
// contact already has its own.
export async function mergeContacts(keepId: string, mergeIds: string[]) {
  const others = mergeIds.filter((id) => id && id !== keepId);
  if (!others.length) return { error: "Pick at least one other contact to merge." };
  const [keep, dupes] = await Promise.all([
    prisma.contact.findUnique({ where: { id: keepId } }),
    prisma.contact.findMany({ where: { id: { in: others } } }),
  ]);
  if (!keep || dupes.length !== others.length) return { error: "One of those contacts no longer exists." };

  const fill: Record<string, unknown> = {};
  for (const f of FILLABLE) {
    if (keep[f] != null && keep[f] !== "") continue;
    const from = dupes.find((d) => d[f] != null && d[f] !== "");
    if (from && from[f] !== keepId) fill[f] = from[f];
  }
  const keepIntegrity = keep.integrityContactId ?? dupes.find((d) => d.integrityContactId)?.integrityContactId ?? null;
  const ignoredLeads = dupes.map((d) => d.integrityContactId).filter((id): id is string => !!id && id !== keepIntegrity);

  await prisma.$transaction([
    prisma.policy.updateMany({ where: { contactId: { in: others } }, data: { contactId: keepId } }),
    prisma.task.updateMany({ where: { contactId: { in: others } }, data: { contactId: keepId } }),
    prisma.contactNote.updateMany({ where: { contactId: { in: others } }, data: { contactId: keepId } }),
    prisma.activity.updateMany({ where: { contactId: { in: others } }, data: { contactId: keepId } }),
    prisma.serviceRequest.updateMany({ where: { contactId: { in: others } }, data: { contactId: keepId } }),
    prisma.contactProvider.updateMany({ where: { contactId: { in: others } }, data: { contactId: keepId } }),
    prisma.contactPharmacy.updateMany({ where: { contactId: { in: others } }, data: { contactId: keepId } }),
    prisma.contactPrescription.updateMany({ where: { contactId: { in: others } }, data: { contactId: keepId } }),
    prisma.contact.updateMany({ where: { spouseId: { in: others } }, data: { spouseId: keepId } }),
    prisma.contact.updateMany({ where: { referredById: { in: others } }, data: { referredById: keepId } }),
    ...ignoredLeads.map((id) =>
      prisma.ignoredIntegrityLead.upsert({
        where: { integrityContactId: id },
        create: { integrityContactId: id, reason: `Merged into ${keep.firstName} ${keep.lastName}` },
        update: {},
      })
    ),
    // Free the duplicates' Integrity ids before giving one to the kept contact.
    prisma.contact.updateMany({ where: { id: { in: others } }, data: { integrityContactId: null } }),
    prisma.contact.update({
      where: { id: keepId },
      data: { ...fill, integrityContactId: keepIntegrity },
    }),
    prisma.activity.create({
      data: {
        contactId: keepId,
        type: "stage",
        summary: `Merged duplicate${dupes.length > 1 ? "s" : ""}: ${dupes.map((d) => `${d.firstName} ${d.lastName}`).join(", ")}`,
      },
    }),
    prisma.contact.deleteMany({ where: { id: { in: others } } }),
  ]);

  revalidatePath("/settings/duplicates");
  revalidatePath("/contacts", "layout");
  revalidatePath("/");
  return { merged: dupes.length };
}
