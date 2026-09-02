"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseCsv } from "@/lib/csv";
import { parseDateCell, formatDateOnly } from "@/lib/date";
import {
  pushIntegrityLeadAddress,
  pushIntegrityLeadEmail,
  pushIntegrityLeadPhone,
  pushIntegrityLeadMedicareInfo,
} from "@/lib/integrity";

const DATE_FIELDS = new Set([
  "dateOfBirth",
  "partAEffectiveDate",
  "partBEffectiveDate",
]);

const COLUMNS: { header: string; field: string; isDate: boolean }[] = [
  { header: "first name", field: "firstName", isDate: false },
  { header: "last name", field: "lastName", isDate: false },
  { header: "email", field: "email", isDate: false },
  { header: "phone", field: "phone", isDate: false },
  { header: "address", field: "address", isDate: false },
  { header: "city", field: "city", isDate: false },
  { header: "state", field: "state", isDate: false },
  { header: "zip", field: "zip", isDate: false },
  { header: "date of birth", field: "dateOfBirth", isDate: true },
  { header: "medicare id", field: "medicareId", isDate: false },
  { header: "part a effective", field: "partAEffectiveDate", isDate: true },
  { header: "part b effective", field: "partBEffectiveDate", isDate: true },
  { header: "doctor", field: "doctor", isDate: false },
  { header: "medical group", field: "medicalGroup", isDate: false },
  { header: "notes", field: "notes", isDate: false },
];

const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  COLUMNS.map((c) => [
    c.field,
    c.header.replace(/\b\w/g, (ch) => ch.toUpperCase()),
  ])
);

const LEAD_ID_HEADER = "integrity lead id";

export interface ImportRowResult {
  rowNumber: number;
  matchedContactId: string | null;
  matchedContactName: string | null;
  matchedBy: "Lead ID" | "Email" | "Name" | null;
  status: "matched" | "ambiguous" | "not_found";
  identityWarnings: string[];
  changes: { field: string; label: string; oldValue: string; newValue: string }[];
  updates: Record<string, string>;
  rowLabel: string;
}

export async function previewContactImport(csvText: string): Promise<{
  rows: ImportRowResult[];
}> {
  const table = parseCsv(csvText);
  if (table.length === 0) return { rows: [] };

  const headerRow = table[0].map((h) => h.trim().toLowerCase());
  const leadIdColIndex = headerRow.indexOf(LEAD_ID_HEADER);
  const columnIndices = COLUMNS.map((col) => ({
    col,
    index: headerRow.indexOf(col.header),
  })).filter((c) => c.index !== -1);

  const contacts = await prisma.contact.findMany();
  type ContactRow = (typeof contacts)[number];

  const byLeadId = new Map<string, ContactRow>();
  const byEmail = new Map<string, ContactRow[]>();
  const byName = new Map<string, ContactRow[]>();

  for (const c of contacts) {
    if (c.integrityContactId) byLeadId.set(c.integrityContactId, c);
    if (c.email) {
      const key = c.email.trim().toLowerCase();
      byEmail.set(key, [...(byEmail.get(key) ?? []), c]);
    }
    const nameKey = `${c.firstName} ${c.lastName}`.trim().toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), c]);
  }

  const results: ImportRowResult[] = [];

  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    if (row.every((cell) => !cell.trim())) continue;

    const getCell = (field: string) => {
      const entry = columnIndices.find((c) => c.col.field === field);
      return entry ? (row[entry.index] ?? "").trim() : "";
    };
    const leadId = leadIdColIndex !== -1 ? (row[leadIdColIndex] ?? "").trim() : "";
    const fileFirstName = getCell("firstName");
    const fileLastName = getCell("lastName");
    const fileEmail = getCell("email");

    const idMatch = leadId ? byLeadId.get(leadId) : undefined;
    const emailCandidates = fileEmail ? byEmail.get(fileEmail.toLowerCase()) ?? [] : [];
    const nameKey =
      fileFirstName && fileLastName ? `${fileFirstName} ${fileLastName}`.toLowerCase() : "";
    const nameCandidates = nameKey ? byName.get(nameKey) ?? [] : [];

    let matched: ContactRow | undefined;
    let matchedBy: ImportRowResult["matchedBy"] = null;
    let status: ImportRowResult["status"] = "not_found";
    const identityWarnings: string[] = [];

    if (idMatch) {
      matched = idMatch;
      matchedBy = "Lead ID";
      status = "matched";
      if (emailCandidates.length && !emailCandidates.some((c) => c.id === idMatch.id)) {
        identityWarnings.push(
          `Email in file belongs to a different contact (${emailCandidates[0].firstName} ${emailCandidates[0].lastName})`
        );
      }
      if (nameCandidates.length && !nameCandidates.some((c) => c.id === idMatch.id)) {
        identityWarnings.push("Name in file matches a different contact");
      }
    } else if (emailCandidates.length === 1) {
      matched = emailCandidates[0];
      matchedBy = "Email";
      status = "matched";
      if (nameCandidates.length && !nameCandidates.some((c) => c.id === matched!.id)) {
        identityWarnings.push("Name in file matches a different contact");
      }
    } else if (emailCandidates.length > 1) {
      status = "ambiguous";
    } else if (nameCandidates.length === 1) {
      matched = nameCandidates[0];
      matchedBy = "Name";
      status = "matched";
    } else if (nameCandidates.length > 1) {
      status = "ambiguous";
    }

    const changes: ImportRowResult["changes"] = [];
    const updates: Record<string, string> = {};

    if (matched) {
      for (const { col, index } of columnIndices) {
        const raw = (row[index] ?? "").trim();
        if (!raw) continue;

        const currentValue = (matched as unknown as Record<string, unknown>)[col.field];

        if (col.isDate) {
          const parsed = parseDateCell(raw);
          if (!parsed) continue;
          const currentDate = currentValue as Date | null;
          const currentFormatted = currentDate ? formatDateOnly(currentDate) : "";
          const newFormatted = formatDateOnly(parsed);
          if (currentFormatted !== newFormatted) {
            changes.push({
              field: col.field,
              label: FIELD_LABELS[col.field],
              oldValue: currentFormatted || "—",
              newValue: newFormatted,
            });
            updates[col.field] = raw;
          }
        } else {
          const currentString = (currentValue as string | null) ?? "";
          if (currentString.trim() !== raw) {
            changes.push({
              field: col.field,
              label: FIELD_LABELS[col.field],
              oldValue: currentString || "—",
              newValue: raw,
            });
            updates[col.field] = raw;
          }
        }
      }
    }

    results.push({
      rowNumber: i + 1,
      matchedContactId: matched?.id ?? null,
      matchedContactName: matched ? `${matched.firstName} ${matched.lastName}` : null,
      matchedBy,
      status,
      identityWarnings,
      changes,
      updates,
      rowLabel:
        [fileFirstName, fileLastName].filter(Boolean).join(" ") ||
        fileEmail ||
        `Row ${i + 1}`,
    });
  }

  return { rows: results };
}

export async function applyContactImport(
  rows: { contactId: string; updates: Record<string, string> }[]
): Promise<{
  updated: number;
  pushResults: { name: string; ok: boolean; error?: string }[];
}> {
  const pushResults: { name: string; ok: boolean; error?: string }[] = [];
  let updated = 0;

  for (const row of rows) {
    const data: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(row.updates)) {
      if (DATE_FIELDS.has(field)) {
        const parsed = parseDateCell(value);
        if (parsed) data[field] = parsed;
      } else {
        data[field] = value;
      }
    }
    if (Object.keys(data).length === 0) continue;

    let contact;
    try {
      contact = await prisma.contact.update({ where: { id: row.contactId }, data });
    } catch {
      continue;
    }
    updated++;

    if (!contact.integrityContactId) continue;

    const changed = new Set(Object.keys(row.updates));
    const name = `${contact.firstName} ${contact.lastName}`;

    if (
      ["address", "city", "state", "zip"].some((f) => changed.has(f)) &&
      contact.address &&
      contact.city &&
      contact.state &&
      contact.zip
    ) {
      try {
        await pushIntegrityLeadAddress(contact.integrityContactId, {
          address1: contact.address,
          city: contact.city,
          stateCode: contact.state,
          postalCode: contact.zip,
        });
        pushResults.push({ name, ok: true });
      } catch (err) {
        pushResults.push({
          name,
          ok: false,
          error: err instanceof Error ? err.message : "Address push failed",
        });
      }
    }

    if (changed.has("email") && contact.email) {
      try {
        await pushIntegrityLeadEmail(contact.integrityContactId, contact.email);
        pushResults.push({ name, ok: true });
      } catch (err) {
        pushResults.push({
          name,
          ok: false,
          error: err instanceof Error ? err.message : "Email push failed",
        });
      }
    }

    if (changed.has("phone") && contact.phone) {
      try {
        await pushIntegrityLeadPhone(contact.integrityContactId, contact.phone);
        pushResults.push({ name, ok: true });
      } catch (err) {
        pushResults.push({
          name,
          ok: false,
          error: err instanceof Error ? err.message : "Phone push failed",
        });
      }
    }

    if (
      ["medicareId", "partAEffectiveDate", "partBEffectiveDate"].some((f) => changed.has(f))
    ) {
      try {
        await pushIntegrityLeadMedicareInfo(contact.integrityContactId, {
          medicareBeneficiaryId: contact.medicareId ?? undefined,
          partA: contact.partAEffectiveDate
            ? contact.partAEffectiveDate.toISOString().slice(0, 10)
            : undefined,
          partB: contact.partBEffectiveDate
            ? contact.partBEffectiveDate.toISOString().slice(0, 10)
            : undefined,
        });
        pushResults.push({ name, ok: true });
      } catch (err) {
        pushResults.push({
          name,
          ok: false,
          error: err instanceof Error ? err.message : "Medicare info push failed",
        });
      }
    }
  }

  revalidatePath("/contacts");
  revalidatePath("/");

  return { updated, pushResults };
}
