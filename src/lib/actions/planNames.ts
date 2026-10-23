"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canonicalCarrier, canonicalPlanName } from "@/lib/carriers";

function refresh() {
  revalidatePath("/settings/plan-names");
  revalidatePath("/contacts", "layout");
  revalidatePath("/enrollments");
  revalidatePath("/book-of-business");
}

// Rewrites every saved plan to the standard carrier spelling and, where it's
// the same plan typed differently, the 2027 list's plan name spelling.
export async function standardizePlanNames() {
  const rows = await prisma.policy.findMany({ distinct: ["carrier", "planName"], select: { carrier: true, planName: true } });
  let changed = 0;
  for (const r of rows) {
    const carrier = canonicalCarrier(r.carrier);
    const planName = canonicalPlanName(carrier, r.planName);
    if (carrier === r.carrier && planName === r.planName) continue;
    const res = await prisma.policy.updateMany({
      where: { carrier: r.carrier, planName: r.planName },
      data: { carrier, planName },
    });
    changed += res.count;
  }
  refresh();
  return { changed };
}

// Renames one carrier + plan name combination on every plan that uses it,
// e.g. to merge "Gold Plus HMO" into "Humana Gold Plus H3767-001 (HMO)".
export async function renamePlan(fromCarrier: string, fromPlan: string, formData: FormData) {
  const carrier = canonicalCarrier(String(formData.get("carrier") ?? fromCarrier));
  const planName = canonicalPlanName(carrier, String(formData.get("planName") ?? ""));
  if (!carrier || !planName) return { error: "Enter the carrier and plan name to change it to." };
  await prisma.policy.updateMany({
    where: { carrier: fromCarrier, planName: fromPlan },
    data: { carrier, planName },
  });
  refresh();
}
