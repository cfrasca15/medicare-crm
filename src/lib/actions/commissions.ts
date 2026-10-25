"use server";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseCsv } from "@/lib/csv";
import { readXlsx } from "@/lib/xlsx";
import { canonicalCarrier, CARRIERS, looseKey, planKey } from "@/lib/carriers";
import { formatDateOnly } from "@/lib/date";
import {
  findHeaderRow,
  guessMapping,
  layoutSignature,
  type StatementLine,
  type StatementMapping,
} from "@/lib/commissionStatement";

function refresh() {
  revalidatePath("/commissions");
  revalidatePath("/enrollments");
  revalidatePath("/contacts", "layout");
}

export interface ReadStatementResult {
  error?: string;
  fileName?: string;
  rows?: string[][];
  headerRow?: number;
  mapping?: StatementMapping;
  carrier?: string;
}

// Reads an uploaded statement (.csv or .xlsx) and guesses its layout. A
// layout seen before comes back with the columns and carrier chosen then.
export async function readStatement(formData: FormData): Promise<ReadStatementResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a statement file first." };
  const name = file.name;
  const ext = name.toLowerCase().split(".").pop();
  let rows: string[][];
  try {
    if (ext === "csv" || ext === "txt") rows = parseCsv((await file.text()).replace(/^﻿/, ""));
    else if (ext === "xlsx") rows = readXlsx(Buffer.from(await file.arrayBuffer()));
    else if (ext === "xls")
      return { error: "That's an older Excel file (.xls). Open it in Excel or Google Sheets and save it as .xlsx or .csv." };
    else if (ext === "pdf")
      return { error: "PDF statements can't be read yet. Most carrier portals also offer the statement as Excel or CSV; download that version." };
    else return { error: "Upload the statement as a .csv or .xlsx file." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't read that file." };
  }
  rows = rows.map((r) => r.map((c) => (c ?? "").toString().trim()));
  while (rows.length && rows[rows.length - 1].every((c) => !c)) rows.pop();
  if (rows.length < 2) return { error: "That file looks empty." };

  const headerRow = findHeaderRow(rows);
  const layout = await prisma.commissionLayout.findUnique({ where: { signature: layoutSignature(rows[headerRow]) } });
  let mapping = guessMapping(rows[headerRow]);
  if (layout) {
    try {
      mapping = JSON.parse(layout.mapping);
    } catch {}
  }
  return { fileName: name, rows: rows.slice(0, 5000), headerRow, mapping, carrier: layout?.carrier ?? guessCarrier(name, rows) };
}

// A carrier named in the file name or the statement's top rows.
function guessCarrier(fileName: string, rows: string[][]): string | undefined {
  const text = ` ${looseKey([fileName, ...rows.slice(0, 6).flat()].join(" "))} `;
  const aliases = CARRIERS.flatMap((c) => [c.name, ...c.aliases].map((a) => ({ name: c.name, key: looseKey(a) })))
    .filter((a) => a.key.length >= 3)
    .sort((a, b) => b.key.length - a.key.length);
  return aliases.find((a) => text.includes(` ${a.key} `))?.name;
}

export interface PolicyOption {
  policyId: string;
  contactId: string;
  label: string;
}

export interface LineMatch {
  policyId: string | null;
  // sure: member ID, or name with birthday or one clear plan; check: a guess
  // worth a look; none: no client found.
  confidence: "sure" | "check" | "none";
  reason: string;
  lineKey: string;
  alreadyImported: boolean;
}

export interface MatchResult {
  matches: LineMatch[];
  // Every plan with this carrier, plus the other plans of matched clients,
  // to pick from when a line needs fixing.
  options: PolicyOption[];
}

const idKey = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const nameKey = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// "Kathy" and "Kathleen", "Bob" stays a miss: same start of at least 3 letters,
// or a lone initial.
function firstNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  const n = Math.min(a.length, b.length, 4);
  return n >= 3 && a.slice(0, n) === b.slice(0, n);
}

function lastNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  // Hyphenated or two-part names: "garcia" matches "garcialopez".
  return a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
}

function keyFor(carrier: string, line: StatementLine, seen: Map<string, number>): string {
  const base = [looseKey(carrier), idKey(line.memberId) || nameKey(line.memberName), line.paidOn ?? "", line.amount.toFixed(2), looseKey(line.description ?? ""), looseKey(line.plan ?? "")].join("|");
  // Two identical lines in one file are both real (e.g. two months paid).
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return createHash("sha1").update(`${base}|${n}`).digest("hex");
}

// Matches each statement line to a client's plan with this carrier.
export async function matchStatement(carrierRaw: string, lines: StatementLine[]): Promise<MatchResult> {
  const carrier = canonicalCarrier(carrierRaw);
  const contacts = await prisma.contact.findMany({
    where: { policies: { some: {} } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      medicareId: true,
      policies: { select: { id: true, carrier: true, planName: true, policyNumber: true, effectiveDate: true, termDate: true, timing: true } },
    },
  });
  type C = (typeof contacts)[number];
  type P = C["policies"][number];
  const label = (c: C, p: P) =>
    `${c.lastName}, ${c.firstName} — ${p.carrier} ${p.planName}${p.effectiveDate ? ` (eff. ${formatDateOnly(p.effectiveDate)})` : ""}`;
  const isCarrier = (p: P) => canonicalCarrier(p.carrier) === carrier;

  const byMbi = new Map<string, C>();
  const byPolicyNumber = new Map<string, { c: C; p: P }>();
  for (const c of contacts) {
    if (idKey(c.medicareId)) byMbi.set(idKey(c.medicareId), c);
    for (const p of c.policies) if (idKey(p.policyNumber)) byPolicyNumber.set(idKey(p.policyNumber), { c, p });
  }

  // The plan this payment is for: this carrier's, closest to the line's plan
  // name and dates.
  const pickPolicy = (c: C, line: StatementLine): P | null => {
    const own = c.policies.filter(isCarrier);
    if (own.length <= 1) return own[0] ?? null;
    const when = line.effectiveDate ?? line.paidOn;
    const score = (p: P) =>
      (line.plan && planKey(p.planName) === planKey(line.plan) ? 4 : 0) +
      (line.effectiveDate && dayKey(p.effectiveDate) === line.effectiveDate ? 4 : 0) +
      (when && p.effectiveDate && dayKey(p.effectiveDate)! <= when && (!p.termDate || dayKey(p.termDate)! > when) ? 2 : 0) +
      (p.timing !== "previous" && !p.termDate ? 1 : 0);
    return [...own].sort((a, b) => score(b) - score(a) || (b.effectiveDate?.getTime() ?? 0) - (a.effectiveDate?.getTime() ?? 0))[0];
  };

  const existing = new Set(
    (await prisma.commissionPayment.findMany({ select: { lineKey: true } })).map((p) => p.lineKey)
  );
  const seen = new Map<string, number>();
  const extraContacts = new Set<string>();

  const matches = lines.map((line): LineMatch => {
    const lineKey = keyFor(carrier, line, seen);
    const base = { lineKey, alreadyImported: existing.has(lineKey) };
    const id = idKey(line.memberId);
    if (id) {
      const byNumber = byPolicyNumber.get(id);
      if (byNumber) return { ...base, policyId: byNumber.p.id, confidence: "sure", reason: "Policy number" };
      const c = byMbi.get(id);
      if (c) {
        const p = pickPolicy(c, line);
        if (!p) extraContacts.add(c.id);
        return p
          ? { ...base, policyId: p.id, confidence: "sure", reason: "Medicare ID" }
          : { ...base, policyId: null, confidence: "check", reason: `${c.firstName} ${c.lastName} (Medicare ID) has no ${carrier} plan` };
      }
    }

    const first = nameKey(line.firstName);
    const last = nameKey(line.lastName);
    let found = contacts.filter((c) => lastNamesMatch(nameKey(c.lastName), last) && firstNamesMatch(nameKey(c.firstName), first));
    // "MARY SMITH" in a last-name-first column.
    if (!found.length && first)
      found = contacts.filter((c) => lastNamesMatch(nameKey(c.lastName), first) && firstNamesMatch(nameKey(c.firstName), last));
    if (line.dob) {
      const sameDob = found.filter((c) => dayKey(c.dateOfBirth) === line.dob);
      if (sameDob.length) found = sameDob;
      else found = found.filter((c) => !c.dateOfBirth);
    }
    const withPlan = found.filter((c) => c.policies.some(isCarrier));
    const pool = withPlan.length ? withPlan : found;
    if (pool.length === 0) return { ...base, policyId: null, confidence: "none", reason: "No client with this name" };
    if (pool.length > 1)
      return { ...base, policyId: pickPolicy(pool[0], line)?.id ?? null, confidence: "check", reason: `${pool.length} clients with this name` };
    const c = pool[0];
    const p = pickPolicy(c, line);
    if (!p) {
      extraContacts.add(c.id);
      return { ...base, policyId: null, confidence: "check", reason: `${c.firstName} ${c.lastName} has no ${carrier} plan` };
    }
    const exactFirst = nameKey(c.firstName) === first;
    const sure = (line.dob && dayKey(c.dateOfBirth) === line.dob) || exactFirst;
    return {
      ...base,
      policyId: p.id,
      confidence: sure ? "sure" : "check",
      reason: line.dob && dayKey(c.dateOfBirth) === line.dob ? "Name and birthday" : exactFirst ? "Name" : `Close name: ${c.firstName} ${c.lastName}`,
    };
  });

  const options: PolicyOption[] = [];
  for (const c of contacts)
    for (const p of c.policies)
      if (isCarrier(p) || extraContacts.has(c.id)) options.push({ policyId: p.id, contactId: c.id, label: label(c, p) });
  options.sort((a, b) => a.label.localeCompare(b.label));
  return { matches, options };
}

export interface ApplyLine {
  policyId: string;
  lineKey: string;
  memberName: string;
  memberId: string | null;
  amount: number;
  paidOn: string | null;
  description: string | null;
}

// Saves the statement: each chosen line is recorded against its plan and
// added to that plan's commission received. Also remembers the layout.
export async function applyStatement(input: {
  carrier: string;
  fileName: string;
  headers: string[];
  mapping: StatementMapping;
  lines: ApplyLine[];
}): Promise<{ error?: string; applied?: number; total?: number }> {
  const carrier = canonicalCarrier(input.carrier);
  if (!carrier) return { error: "Pick the carrier this statement is from." };
  const already = new Set(
    (await prisma.commissionPayment.findMany({ where: { lineKey: { in: input.lines.map((l) => l.lineKey) } }, select: { lineKey: true } })).map(
      (p) => p.lineKey
    )
  );
  const lines = input.lines.filter((l) => l.policyId && !already.has(l.lineKey) && Number.isFinite(l.amount));
  if (!lines.length) return { error: "Nothing to apply: tick at least one matched line." };

  const day = (s: string | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
  const perPolicy = new Map<string, { sum: number; last: Date | null }>();
  for (const l of lines) {
    const cur = perPolicy.get(l.policyId) ?? { sum: 0, last: null };
    cur.sum += l.amount;
    const d = day(l.paidOn);
    if (d && (!cur.last || d > cur.last)) cur.last = d;
    perPolicy.set(l.policyId, cur);
  }
  const policies = await prisma.policy.findMany({
    where: { id: { in: [...perPolicy.keys()] } },
    select: { id: true, commissionReceived: true },
  });
  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const now = new Date();

  await prisma.$transaction([
    prisma.commissionStatement.create({
      data: {
        carrier,
        fileName: input.fileName,
        total,
        lineCount: lines.length,
        payments: {
          create: lines.map((l) => ({
            policyId: l.policyId,
            memberName: l.memberName,
            memberId: l.memberId,
            amount: l.amount,
            paidOn: day(l.paidOn),
            description: l.description,
            lineKey: l.lineKey,
          })),
        },
      },
    }),
    ...policies.map((p) => {
      const add = perPolicy.get(p.id)!;
      return prisma.policy.update({
        where: { id: p.id },
        data: {
          commissionReceived: Math.round(((p.commissionReceived ?? 0) + add.sum) * 100) / 100,
          commissionPaidAt: add.last ?? now,
        },
      });
    }),
    prisma.commissionLayout.upsert({
      where: { signature: layoutSignature(input.headers) },
      create: { signature: layoutSignature(input.headers), carrier, mapping: JSON.stringify(input.mapping) },
      update: { carrier, mapping: JSON.stringify(input.mapping) },
    }),
  ]);
  refresh();
  return { applied: lines.length, total };
}

// Removes a statement and takes its amounts back off each plan's
// commission received.
export async function undoStatement(statementId: string) {
  const payments = await prisma.commissionPayment.findMany({ where: { statementId }, select: { policyId: true, amount: true } });
  const perPolicy = new Map<string, number>();
  for (const p of payments) if (p.policyId) perPolicy.set(p.policyId, (perPolicy.get(p.policyId) ?? 0) + p.amount);
  const policies = await prisma.policy.findMany({
    where: { id: { in: [...perPolicy.keys()] } },
    select: { id: true, commissionReceived: true, payments: { where: { statementId: { not: statementId } }, select: { paidOn: true }, orderBy: { paidOn: "desc" }, take: 1 } },
  });
  await prisma.$transaction([
    ...policies.map((p) => {
      const left = Math.round(((p.commissionReceived ?? 0) - perPolicy.get(p.id)!) * 100) / 100;
      const nothingLeft = Math.abs(left) < 0.005 && p.payments.length === 0;
      return prisma.policy.update({
        where: { id: p.id },
        data: {
          commissionReceived: nothingLeft ? null : left,
          commissionPaidAt: p.payments.length ? p.payments[0].paidOn : nothingLeft ? null : undefined,
        },
      });
    }),
    prisma.commissionStatement.delete({ where: { id: statementId } }),
  ]);
  refresh();
}
