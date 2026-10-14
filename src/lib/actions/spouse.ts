"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface SpouseMatch {
  id: string;
  name: string;
  detail: string;
}

// Contacts whose name matches what was typed, for linking a spouse.
export async function searchSpouseCandidates(contactId: string, q: string): Promise<SpouseMatch[]> {
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (words.length === 0) return [];
  const rows = await prisma.contact.findMany({
    where: {
      id: { not: contactId },
      AND: words.map((w) => ({ OR: [{ firstName: { contains: w } }, { lastName: { contains: w } }] })),
    },
    select: { id: true, firstName: true, lastName: true, city: true, phone: true, dateOfBirth: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 8,
  });
  return rows.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    detail: [c.city, c.phone, c.dateOfBirth ? `born ${c.dateOfBirth.getUTCFullYear()}` : null]
      .filter(Boolean)
      .join(" · "),
  }));
}

// Links two contacts to each other, replacing any spouse either one had.
export async function linkSpouse(contactId: string, spouseId: string) {
  if (contactId === spouseId) return { error: "Pick a different contact." };
  await prisma.$transaction([
    prisma.contact.updateMany({
      where: { spouseId: { in: [contactId, spouseId] } },
      data: { spouseId: null },
    }),
    prisma.contact.update({ where: { id: contactId }, data: { spouseId } }),
    prisma.contact.update({ where: { id: spouseId }, data: { spouseId: contactId } }),
  ]);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/contacts/${spouseId}`);
}

export async function unlinkSpouse(contactId: string) {
  await prisma.contact.updateMany({
    where: { OR: [{ id: contactId }, { spouseId: contactId }] },
    data: { spouseId: null },
  });
  revalidatePath("/contacts", "layout");
}
