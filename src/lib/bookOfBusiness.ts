import { prisma } from "@/lib/prisma";
import { planGroup } from "@/lib/coverage";
import { canonicalCarrier, canonicalPlanName, planKey } from "@/lib/carriers";

export interface BookRow {
  policyId: string;
  county: string | null;
  contactId: string;
  name: string;
  phone: string | null;
  carrier: string;
  planName: string;
  planType: string | null;
  medicalGroup: string | null;
  doctor: string | null;
  status: "current" | "future";
  effectiveDate: Date | null;
}

export type BookView = "group" | "plan" | "doctor";

export interface BookFilters {
  carrier?: string;
  group?: string;
  county?: string;
  q?: string;
}

// Spelling-insensitive key, so "Hoag" and "hoag " land together.
export const keyOf = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Medical groups that belong to one larger organization, shown together on
// the Book of Business page. A group matches when its name contains any of
// the listed names ("St." and "Saint" count as "St").
const GROUP_FAMILIES: { name: string; members: string[] }[] = [
  // Orange County: all part of Providence.
  { name: "Providence", members: ["providence", "mission heritage", "st joseph heritage", "st jude heritage"] },
];

export const loose = (s: string) => keyOf(s).replace(/\bsaint\b/g, "st").replace(/\bst\./g, "st").replace(/[^a-z0-9 ]/g, "");

// The organization a medical group belongs to (e.g. "St Jude Heritage" ->
// "Providence"), or the group's own name.
export function groupFamily(group: string | null | undefined): string | null {
  const g = group?.trim();
  if (!g) return null;
  const l = loose(g);
  return GROUP_FAMILIES.find((f) => f.members.some((m) => l.includes(m)))?.name ?? g;
}

// Every client's current and upcoming plans (ended plans are left out).
export async function loadBook(filters: BookFilters = {}): Promise<BookRow[]> {
  const policies = await prisma.policy.findMany({
    include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true, cellPhone: true, cellPreferred: true, county: true } } },
  });
  const q = keyOf(filters.q);
  return policies
    .map((p) => ({ p, status: planGroup(p) }))
    .filter((x): x is { p: (typeof policies)[number]; status: "current" | "future" } => x.status !== "previous")
    .map(({ p, status }) => ({
      policyId: p.id,
      contactId: p.contact.id,
      name: `${p.contact.firstName} ${p.contact.lastName}`,
      county: p.contact.county,
      phone: p.contact.cellPreferred && p.contact.cellPhone ? p.contact.cellPhone : p.contact.phone ?? p.contact.cellPhone,
      // Standard spellings, so the same plan typed two ways is listed once.
      carrier: canonicalCarrier(p.carrier),
      planName: canonicalPlanName(p.carrier, p.planName),
      planType: p.planType,
      medicalGroup: p.medicalGroup,
      doctor: p.doctor,
      status,
      effectiveDate: p.effectiveDate,
    }))
    .filter((r) => !filters.carrier || keyOf(r.carrier) === keyOf(filters.carrier))
    .filter((r) => !filters.county || keyOf(r.county) === keyOf(filters.county))
    .filter(
      (r) =>
        !filters.group ||
        keyOf(r.medicalGroup) === keyOf(filters.group) ||
        keyOf(groupFamily(r.medicalGroup)) === keyOf(filters.group)
    )
    .filter(
      (r) =>
        !q ||
        [r.name, r.carrier, r.planName, r.medicalGroup, r.doctor].some((v) => keyOf(v).includes(q))
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface BookSection {
  title: string;
  subsections: { title: string; rows: BookRow[] }[];
  count: number;
  clients: number;
}

// Groups rows two levels deep: by medical group then plan, by carrier then
// plan, or by doctor then plan. Blank values sort last.
export function groupBook(rows: BookRow[], view: BookView): BookSection[] {
  type Level = (r: BookRow) => { key: string; title: string };
  const text = (v: string | null | undefined): ReturnType<Level> => ({ key: keyOf(v), title: v?.trim() ?? "" });
  // Plans match loosely ("Inspire" and "Blue Shield Inspire (HMO)" are one).
  const plan = (withCarrier: boolean): Level => (r) => ({
    key: `${keyOf(r.carrier)}|${planKey(r.planName)}`,
    title: withCarrier ? `${r.carrier} — ${r.planName}` : r.planName,
  });
  const [outer, inner, blankOuter, blankInner]: [Level, Level, string, string] =
    view === "plan"
      ? [(r) => text(r.carrier), plan(false), "No carrier", "No plan"]
      : view === "doctor"
        ? [(r) => text(r.doctor), plan(true), "No doctor entered", "No plan"]
        : [(r) => text(groupFamily(r.medicalGroup)), plan(true), "No medical group entered", "No plan"];

  const sections = new Map<string, { title: string; inner: Map<string, { title: string; rows: BookRow[] }> }>();
  for (const r of rows) {
    const o = outer(r);
    const i = inner(r);
    if (!sections.has(o.key)) sections.set(o.key, { title: o.title || blankOuter, inner: new Map() });
    const sec = sections.get(o.key)!;
    if (!sec.inner.has(i.key)) sec.inner.set(i.key, { title: i.title || blankInner, rows: [] });
    sec.inner.get(i.key)!.rows.push(r);
  }
  const byTitle = (a: [string, { title: string }], b: [string, { title: string }]) =>
    (a[0] === "" ? 1 : 0) - (b[0] === "" ? 1 : 0) || a[1].title.localeCompare(b[1].title);
  return [...sections.entries()].sort(byTitle).map(([, s]) => {
    const subsections = [...s.inner.entries()].sort(byTitle).map(([, x]) => x);
    const all = subsections.flatMap((x) => x.rows);
    return { title: s.title, subsections, count: all.length, clients: new Set(all.map((r) => r.contactId)).size };
  });
}
