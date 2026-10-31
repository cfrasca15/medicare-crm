import { prisma } from "@/lib/prisma";
import { LEAD_SOURCES, isWebsiteSource } from "@/lib/leadSource";

// The usual lead sources, then any others already used on a contact. The
// website's own detailed sources ("Website: call-back request") aren't for picking.
export async function leadSourceOptions(): Promise<string[]> {
  const rows = await prisma.contact.findMany({
    distinct: ["leadSource"],
    select: { leadSource: true },
    where: { leadSource: { not: null } },
  });
  const used = rows.map((r) => r.leadSource as string).filter((s) => !isWebsiteSource(s) && !LEAD_SOURCES.includes(s));
  return [...LEAD_SOURCES, ...used.sort((a, b) => a.localeCompare(b))];
}
