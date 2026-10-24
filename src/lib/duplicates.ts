import { prisma } from "@/lib/prisma";

export interface DuplicateContact {
  id: string;
  name: string;
  firstName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: Date | null;
  stage: string;
  plans: number;
  notes: number;
  integrityLinked: boolean;
  leadSource: string | null;
  createdAt: Date;
}

export interface DuplicateGroup {
  reasons: string[];
  contacts: DuplicateContact[];
}

const digits10 = (s: string | null) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};

// Contacts that look like the same person: same phone (either number), same
// email, or same first and last name. Linked matches are grouped together.
export async function findDuplicates(): Promise<DuplicateGroup[]> {
  const rows = await prisma.contact.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      cellPhone: true,
      email: true,
      dateOfBirth: true,
      stage: true,
      integrityContactId: true,
      leadSource: true,
      createdAt: true,
      _count: { select: { policies: true, noteEntries: true } },
    },
  });

  // Union-find over contacts that share a key.
  const parent = new Map<string, string>(rows.map((r) => [r.id, r.id]));
  const find = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const reasons = new Map<string, Set<string>>();
  const byKey = new Map<string, string[]>();
  for (const r of rows) {
    const keys: [string, string][] = [];
    for (const ph of [digits10(r.phone), digits10(r.cellPhone)]) if (ph) keys.push([`phone:${ph}`, "same phone"]);
    const email = r.email?.trim().toLowerCase();
    if (email) keys.push([`email:${email}`, "same email"]);
    const name = `${r.firstName} ${r.lastName}`.trim().toLowerCase().replace(/\s+/g, " ");
    if (name) keys.push([`name:${name}`, "same name"]);
    for (const [k, why] of keys) {
      const list = byKey.get(k) ?? [];
      if (list.length) {
        const a = find(list[0]);
        const b = find(r.id);
        if (a !== b) parent.set(b, a);
        reasons.set(k, new Set([...(reasons.get(k) ?? []), why]));
      }
      list.push(r.id);
      byKey.set(k, list);
    }
  }

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const root = find(r.id);
    groups.set(root, [...(groups.get(root) ?? []), r]);
  }
  const groupReasons = (ids: Set<string>) => {
    const out = new Set<string>();
    for (const [k, list] of byKey) if (list.length > 1 && list.some((id) => ids.has(id))) reasons.get(k)?.forEach((w) => out.add(w));
    return [...out];
  };

  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      reasons: groupReasons(new Set(g.map((r) => r.id))),
      contacts: g
        .map((r) => ({
          id: r.id,
          name: `${r.firstName} ${r.lastName}`,
          firstName: r.firstName,
          phone: r.phone ?? r.cellPhone,
          email: r.email,
          dateOfBirth: r.dateOfBirth,
          stage: r.stage,
          plans: r._count.policies,
          notes: r._count.noteEntries,
          integrityLinked: Boolean(r.integrityContactId),
          leadSource: r.leadSource,
          createdAt: r.createdAt,
        }))
        // Most complete first, so it's the default to keep.
        .sort((a, b) => b.plans + b.notes + (b.integrityLinked ? 5 : 0) - (a.plans + a.notes + (a.integrityLinked ? 5 : 0))),
    }))
    .sort((a, b) => a.contacts[0].name.localeCompare(b.contacts[0].name));
}
