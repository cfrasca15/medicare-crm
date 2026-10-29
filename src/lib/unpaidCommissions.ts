import { prisma } from "@/lib/prisma";

// Plans that started 60+ days ago with an expected commission and nothing
// received: the payments to chase. On /commissions and in the morning digest.
export async function loadUnpaid(now = new Date()) {
  return prisma.policy.findMany({
    where: {
      effectiveDate: { lte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
      termDate: null,
      commissionAmount: { gt: 0 },
      OR: [{ commissionReceived: null }, { commissionReceived: 0 }],
      contact: { stage: { not: "LOST" } },
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ carrier: "asc" }, { effectiveDate: "asc" }],
  });
}
