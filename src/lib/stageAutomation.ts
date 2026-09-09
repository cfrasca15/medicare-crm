import { prisma } from "@/lib/prisma";

// A contact sitting at Application Submitted with any policy whose
// effective date has arrived is, by definition, enrolled now — advance
// them automatically so nobody has to remember to flip the dropdown once
// the plan actually starts. Only ever moves Application Submitted ->
// Enrolled; contacts elsewhere in the pipeline are untouched.
export async function advanceEnrolledStages(): Promise<{ advanced: number }> {
  const now = new Date();

  const due = await prisma.contact.findMany({
    where: {
      stage: "APPLICATION_SUBMITTED",
      policies: { some: { effectiveDate: { not: null, lte: now } } },
    },
    select: { id: true },
  });

  if (due.length === 0) return { advanced: 0 };

  await prisma.contact.updateMany({
    where: { id: { in: due.map((c) => c.id) } },
    data: { stage: "ENROLLED" },
  });

  return { advanced: due.length };
}
