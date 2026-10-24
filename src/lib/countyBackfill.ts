import { prisma } from "@/lib/prisma";
import { countyForZip } from "@/lib/county";

// Fills in County from the ZIP for any contact that has a ZIP but no county.
export async function fillCountiesFromZip(): Promise<number> {
  const rows = await prisma.contact.findMany({
    where: { county: null, zip: { not: null } },
    select: { id: true, zip: true },
  });
  let filled = 0;
  for (const r of rows) {
    const county = countyForZip(r.zip);
    if (!county) continue;
    await prisma.contact.update({ where: { id: r.id }, data: { county } });
    filled++;
  }
  return filled;
}
