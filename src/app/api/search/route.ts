import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/constants";

// Contacts matching the quick search (Ctrl+K): name, phone, cell or email.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json([]);

  const words = q.split(/\s+/).slice(0, 3);
  const digits = q.replace(/\D/g, "");
  const rows = await prisma.contact.findMany({
    where: {
      OR: [
        { AND: words.map((w) => ({ OR: [{ firstName: { contains: w } }, { lastName: { contains: w } }] })) },
        { email: { contains: q } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { cellPhone: { contains: digits } }] : []),
      ],
    },
    select: { id: true, firstName: true, lastName: true, phone: true, cellPhone: true, stage: true, city: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 8,
  });

  return Response.json(
    rows.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      detail: [STAGE_LABELS[c.stage], c.city, c.phone ?? c.cellPhone].filter(Boolean).join(" · "),
    }))
  );
}
