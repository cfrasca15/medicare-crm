import { prisma } from "@/lib/prisma";
import { dateInputValue, todayInputValue } from "@/lib/date";

export type RequestFilter = "open" | "resolved" | "all";

// Service requests with their client and latest update. Open ones come
// follow-up date first (overdue at the top), then oldest first.
export async function loadServiceRequests(filter: RequestFilter = "open", category?: string, take?: number) {
  const rows = await prisma.serviceRequest.findMany({
    where: {
      ...(filter === "open" ? { status: { not: "resolved" } } : filter === "resolved" ? { status: "resolved" } : {}),
      ...(category ? { category } : {}),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      policy: { select: { carrier: true, planName: true } },
      updates: { orderBy: { createdAt: "desc" }, take: 1, select: { summary: true, createdAt: true } },
    },
    orderBy: filter === "resolved" ? { resolvedAt: "desc" } : { createdAt: "asc" },
  });
  if (filter !== "resolved") {
    const key = (r: (typeof rows)[number]) => (r.status === "resolved" ? "~" : r.followUpOn ? dateInputValue(r.followUpOn) : "9999");
    rows.sort((a, b) => key(a).localeCompare(key(b)));
  }
  return take ? rows.slice(0, take) : rows;
}

// True when a follow-up date is today or earlier (Pacific).
export const isDue = (followUpOn: Date | null) => followUpOn != null && dateInputValue(followUpOn) <= todayInputValue();
