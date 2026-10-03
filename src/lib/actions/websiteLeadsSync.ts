"use server";

import { prisma } from "@/lib/prisma";
import { listWebsiteLeads, deleteWebsiteLead } from "@/lib/websiteLeads";
import { revalidatePath } from "next/cache";

const SOURCE_LABEL: Record<string, string> = {
  contact: "contact form",
  callback: "call-back request",
  rsvp: "event RSVP",
};

function submittedDate(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// Last 10 digits, so "(949) 555-0100", "949-555-0100", and "+1 949 555 0100" match.
function phoneKey(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "unknown time";
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export type WebsiteLeadsSyncResult =
  | { ok: true; imported: number; matched: number; skipped: number; cleanupFailed: number }
  | { ok: false; error: string };

// Server action errors are replaced with a generic "Minified React error #441"
// in production, so return failures as data and show the real reason in the UI.
export async function syncWebsiteLeads(): Promise<WebsiteLeadsSyncResult> {
  try {
    return { ok: true, ...(await runSync()) };
  } catch (err) {
    console.error("syncWebsiteLeads failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column|leadSource|lastWebsiteLeadAt/i.test(msg)) {
      return {
        ok: false,
        error:
          "The database is missing the new website-lead columns. Rebuild and restart the container so the migration runs.",
      };
    }
    return { ok: false, error: msg.slice(0, 300) };
  }
}

async function runSync(): Promise<{
  imported: number;
  matched: number;
  skipped: number;
  cleanupFailed: number;
}> {
  const leads = await listWebsiteLeads();

  let imported = 0;
  let matched = 0;
  let skipped = 0;
  let cleanupFailed = 0;

  // Phone lookup built once per sync so we can match existing contacts.
  const withPhones = await prisma.contact.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  const byPhone = new Map<string, string>();
  for (const c of withPhones) {
    const key = phoneKey(c.phone);
    if (key && !byPhone.has(key)) byPhone.set(key, c.id);
  }

  for (const lead of leads) {
    const marker = `[web-lead ${lead.recordId}]`;

    // Already imported (e.g. the Airtable delete failed last time): just clean up.
    const already = await prisma.contactNote.findFirst({
      where: { body: { startsWith: marker } },
      select: { id: true },
    });
    if (already) {
      skipped++;
      if (!(await deleteWebsiteLead(lead.recordId))) cleanupFailed++;
      continue;
    }

    // Need some way to reach the person.
    if (!lead.email && !phoneKey(lead.phone) && !lead.phone) {
      skipped++;
      continue;
    }

    let contactId: string | undefined;
    if (lead.email) {
      const existing = await prisma.contact.findFirst({
        where: { email: { equals: lead.email } },
        select: { id: true },
      });
      contactId = existing?.id;
    }
    if (!contactId) {
      const key = phoneKey(lead.phone);
      if (key) contactId = byPhone.get(key);
    }

    const isNew = !contactId;
    if (!contactId) {
      const created = await prisma.contact.create({
        data: {
          firstName: lead.firstName || "Website",
          lastName: lead.lastName || "Lead",
          email: lead.email || null,
          phone: lead.phone || null,
          stage: "NEW_LEAD",
          leadSource: `Website: ${SOURCE_LABEL[lead.source] ?? "form"}`,
          lastWebsiteLeadAt: submittedDate(lead.submittedAt),
        },
      });
      contactId = created.id;
      const key = phoneKey(lead.phone);
      if (key) byPhone.set(key, created.id);
      imported++;
    } else {
      matched++;
      // Existing contact reached out again: remember when, without changing their stage or source.
      await prisma.contact.update({
        where: { id: contactId },
        data: { lastWebsiteLeadAt: submittedDate(lead.submittedAt) },
      });
    }

    const label = SOURCE_LABEL[lead.source] ?? lead.source ?? "website";
    const lines = [
      `${marker} ${isNew ? "New" : "Returning"} lead from the website (${label}), ${formatWhen(lead.submittedAt)} PT.`,
    ];
    if (lead.detail) lines.push(lead.detail);
    if (lead.consent) lines.push(lead.consent);

    await prisma.contactNote.create({
      data: { contactId, body: lines.join("\n") },
    });

    // The CRM now holds the record, including the consent line; remove it from Airtable.
    if (!(await deleteWebsiteLead(lead.recordId))) cleanupFailed++;
  }

  revalidatePath("/contacts");
  revalidatePath("/");

  return { imported, matched, skipped, cleanupFailed };
}
