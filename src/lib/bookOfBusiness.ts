import { prisma } from "@/lib/prisma";
import { planGroup } from "@/lib/coverage";

export interface BookRow {
  policyId: string;
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

const loose = (s: string) => keyOf(s).replace(/\bsaint\b/g, "st").replace(/\bst\./g, "st").replace(/[^a-z0-9 ]/g, "");

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
    include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true, cellPhone: true, cellPreferred: true } } },
  });
  const q = keyOf(filters.q);
  return policies
    .map((p) => ({ p, status: planGroup(p) }))
    .filter((x): x is { p: (typeof policies)[number]; status: "current" | "future" } => x.status !== "previous")
    .map(({ p, status }) => ({
      policyId: p.id,
      contactId: p.contact.id,
      name: `${p.contact.firstName} ${p.contact.lastName}`,
      phone: p.contact.cellPreferred && p.contact.cellPhone ? p.contact.cellPhone : p.contact.phone ?? p.contact.cellPhone,
      carrier: p.carrier,
      planName: p.planName,
      planType: p.planType,
      medicalGroup: p.medicalGroup,
      doctor: p.doctor,
      status,
      effectiveDate: p.effectiveDate,
    }))
    .filter((r) => !filters.carrier || keyOf(r.carrier) === keyOf(filters.carrier))
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
}

// Groups rows two levels deep: by medical group then plan, by plan then
// medical group, or by doctor then plan. Blank values sort last.
export function groupBook(rows: BookRow[], view: BookView): BookSection[] {
  const planTitle = (r: BookRow) => `${r.carrier} — ${r.planName}`;
  const [outer, inner, blankOuter, blankInner] =
    view === "plan"
      ? [planTitle, (r: BookRow) => groupFamily(r.medicalGroup), "No plan", "No medical group entered"]
      : view === "doctor"
        ? [(r: BookRow) => r.doctor, planTitle, "No doctor entered", "No plan"]
        : [(r: BookRow) => groupFamily(r.medicalGroup), planTitle, "No medical group entered", "No plan"];

  const sections = new Map<string, { title: string; inner: Map<string, { title: string; rows: BookRow[] }> }>();
  for (const r of rows) {
    const o = outer(r)?.trim() || "";
    const i = inner(r)?.trim() || "";
    const ok = keyOf(o);
    if (!sections.has(ok)) sections.set(ok, { title: o || blankOuter, inner: new Map() });
    const sec = sections.get(ok)!;
    const ik = keyOf(i);
    if (!sec.inner.has(ik)) sec.inner.set(ik, { title: i || blankInner, rows: [] });
    sec.inner.get(ik)!.rows.push(r);
  }
  const byTitle = (a: [string, { title: string }], b: [string, { title: string }]) =>
    (a[0] === "" ? 1 : 0) - (b[0] === "" ? 1 : 0) || a[1].title.localeCompare(b[1].title);
  return [...sections.entries()].sort(byTitle).map(([, s]) => {
    const subsections = [...s.inner.entries()].sort(byTitle).map(([, x]) => x);
    return { title: s.title, subsections, count: subsections.reduce((n, x) => n + x.rows.length, 0) };
  });
}
