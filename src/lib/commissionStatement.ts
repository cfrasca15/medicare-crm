// Reading carrier commission statements: finding the header row, guessing
// which column is which, and turning each line into a payment. Pure
// functions, used by both the upload screen and the server.

export const STATEMENT_FIELDS = [
  { key: "name", label: "Member name" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "memberId", label: "Member ID / policy #" },
  { key: "dob", label: "Date of birth" },
  { key: "amount", label: "Commission amount" },
  { key: "paidOn", label: "Paid / statement date" },
  { key: "effectiveDate", label: "Effective date" },
  { key: "plan", label: "Plan" },
  { key: "description", label: "Type / description" },
] as const;

export type StatementField = (typeof STATEMENT_FIELDS)[number]["key"];
// Column index for each field (missing = not in this statement).
export type StatementMapping = Partial<Record<StatementField, number>>;

export interface StatementLine {
  row: number; // index in the file's rows, for showing the original
  memberName: string;
  firstName: string;
  lastName: string;
  memberId: string | null;
  dob: string | null; // yyyy-mm-dd
  amount: number;
  paidOn: string | null; // yyyy-mm-dd
  effectiveDate: string | null; // yyyy-mm-dd
  plan: string | null;
  description: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9#%]+/g, " ").trim();
// Whole words only ("id" rules out "member id" but not "paid amount").
const has = (h: string, words: string[]) =>
  words.some((w) => (/^[a-z0-9 ]+$/.test(w) ? ` ${h} `.includes(` ${w} `) : h.includes(w)));

// For each field, header texts it can go by (best first) and words that rule
// a header out ("plan name" isn't the member's name).
const RULES: Record<StatementField, { want: string[]; not?: string[]; exact?: string[] }> = {
  amount: {
    want: ["net commission", "commission amount", "comm amt", "commission paid", "amount paid", "paid amount", "payment amount", "net amount", "net pay", "commission", "comm", "amount", "payment", "total"],
    not: ["date", "rate", "%", "percent", "premium", "type", "id", "count", "status", "basis", "schedule", "level", "code", "split", "year"],
  },
  paidOn: {
    want: ["paid date", "payment date", "pay date", "statement date", "check date", "process date", "processed date", "transaction date", "run date", "cycle date", "pay period", "period"],
    exact: ["date"],
  },
  effectiveDate: { want: ["effective", "eff date", "eff dt", "issue date", "coverage start", "policy start", "start date"] },
  dob: { want: ["dob", "birth"] },
  firstName: { want: ["first name", "first", "fname"], not: ["agent", "writing", "producer"] },
  lastName: { want: ["last name", "last", "lname", "surname"], not: ["agent", "writing", "producer"] },
  name: {
    want: ["member name", "insured name", "subscriber name", "beneficiary name", "enrollee name", "customer name", "client name", "policyholder", "policy holder", "insured", "member", "name"],
    not: ["plan", "agent", "product", "carrier", "first", "last", "middle", "file", "group", "company", "writing", "producer", "upline", "agency", "id", "number", "#", "no"],
  },
  memberId: {
    want: ["mbi", "medicare id", "medicare number", "member id", "member number", "member #", "member no", "subscriber id", "policy number", "policy #", "policy id", "policy no", "certificate", "cert", "hicn", "application id", "app id"],
    not: ["agent", "writing", "producer", "npn", "contract id"],
  },
  plan: { want: ["plan name", "product name", "plan description", "plan", "product"], not: ["date", "type", "id"] },
  description: {
    want: ["transaction type", "commission type", "comm type", "pay type", "payment type", "description", "reason", "activity", "comment", "type"],
    not: ["plan type", "product type"],
  },
};

// Fields claimed in this order, so "commission amount" goes to amount before
// a looser rule can take it.
const ORDER: StatementField[] = ["amount", "paidOn", "effectiveDate", "dob", "firstName", "lastName", "memberId", "name", "plan", "description"];

export function guessMapping(headers: string[]): StatementMapping {
  const h = headers.map(norm);
  const used = new Set<number>();
  const out: StatementMapping = {};
  for (const field of ORDER) {
    const rule = RULES[field];
    let pick: number | undefined;
    for (const e of rule.exact ?? []) {
      const i = h.findIndex((x, j) => !used.has(j) && x === e);
      if (i >= 0) pick ??= i;
    }
    for (const w of rule.want) {
      if (pick != null) break;
      const i = h.findIndex((x, j) => !used.has(j) && x.includes(w) && !has(x, rule.not ?? []));
      if (i >= 0) pick = i;
    }
    if (pick != null) {
      out[field] = pick;
      used.add(pick);
    }
  }
  // A full name column and first/last columns: use first/last.
  if (out.firstName != null && out.lastName != null) delete out.name;
  return out;
}

// The header row: the first of the top rows that names an amount and a
// member (statements often start with a title or summary block).
export function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const m = guessMapping(rows[i]);
    if (m.amount != null && (m.name != null || m.lastName != null || m.memberId != null)) return i;
  }
  return Math.max(0, rows.findIndex((r) => r.filter((c) => c.trim()).length >= 3));
}

// The layout's fingerprint: its header names, so the same carrier report
// is recognised next time.
export const layoutSignature = (headers: string[]) => headers.map(norm).filter(Boolean).join("|");

// "$1,234.50", "(45.00)" and "-45" -> numbers; anything else -> null.
export function parseAmount(raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /^-|-$/.test(s.replace(/[$\s]/g, ""));
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!s.match(/\d/) || Number.isNaN(n)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

const ymd = (y: number, m: number, d: number) =>
  y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

// Dates as statements write them: 1/5/2027, 01/05/27, 2027-01-05, 20270105,
// an Excel day number, or "Jan 2027" (the 1st).
export function parseStatementDate(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/);
  if (m) return ymd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(s)) * 86400000);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{4})$/i);
  if (m) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].toLowerCase());
    if (month >= 0) return ymd(+m[2], month + 1, 1);
  }
  m = s.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) return ymd(+m[2], +m[1], 1);
  return null;
}

const SUFFIX = /^(jr|sr|ii|iii|iv)$/i;

// "SMITH, MARY A" or "Mary A Smith" -> first and last name.
export function splitName(raw: string): { first: string; last: string } {
  const s = raw.trim().replace(/\s+/g, " ");
  if (s.includes(",")) {
    const [last, rest] = s.split(",", 2).map((x) => x.trim());
    return { first: rest.split(" ")[0] ?? "", last };
  }
  const parts = s.split(" ").filter((p) => !SUFFIX.test(p.replace(/\./g, "")));
  if (parts.length < 2) return { first: "", last: parts[0] ?? "" };
  return { first: parts[0], last: parts[parts.length - 1] };
}

// The statement's lines with an amount, using the chosen columns.
export function readLines(rows: string[][], headerRow: number, mapping: StatementMapping): StatementLine[] {
  const cell = (r: string[], f: StatementField) => (mapping[f] != null ? (r[mapping[f]!] ?? "").trim() : "");
  const out: StatementLine[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const amount = parseAmount(cell(r, "amount"));
    if (amount == null || amount === 0) continue;
    let first = cell(r, "firstName");
    let last = cell(r, "lastName");
    const full = cell(r, "name");
    if (!first && !last && full) ({ first, last } = splitName(full));
    const memberName = full || [first, last].filter(Boolean).join(" ");
    const memberId = cell(r, "memberId") || null;
    // Total and subtotal lines have an amount but nobody's name.
    if (!memberName && !memberId) continue;
    if (/^(grand )?(sub)?total/i.test(memberName)) continue;
    out.push({
      row: i,
      memberName: memberName || memberId!,
      firstName: first,
      lastName: last,
      memberId,
      dob: parseStatementDate(cell(r, "dob")),
      amount,
      paidOn: parseStatementDate(cell(r, "paidOn")),
      effectiveDate: parseStatementDate(cell(r, "effectiveDate")),
      plan: cell(r, "plan") || null,
      description: cell(r, "description") || null,
    });
  }
  return out;
}
