"use server";

import { prisma } from "@/lib/prisma";
import { PipelineStage } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

// Saves the CRM stage chosen for each Integrity status. The form sends one
// "stage-<code>" field per status; blank means "start at New Lead".
export async function saveStageMappings(formData: FormData) {
  const mappings = await prisma.integrityStageMapping.findMany({ select: { code: true } });
  await prisma.$transaction(
    mappings.map(({ code }) => {
      const raw = String(formData.get(`stage-${code}`) ?? "").trim();
      return prisma.integrityStageMapping.update({
        where: { code },
        data: { pipelineStage: raw ? (raw as PipelineStage) : null },
      });
    })
  );
  revalidatePath("/settings/integrity-stages");
}

// A mapping is only applied automatically when a lead is first imported, so
// contacts synced before a mapping existed are stuck at the CRM's default
// (New Lead) even after you set one up. This lets you push mappings onto
// those existing contacts in bulk, without touching anything you've since
// moved manually — only contacts still sitting at New Lead are eligible.
export async function reapplyStageMappings(): Promise<{ updated: number }> {
  const mappings = await prisma.integrityStageMapping.findMany({
    where: { pipelineStage: { not: null } },
  });

  let updated = 0;
  for (const mapping of mappings) {
    if (!mapping.pipelineStage) continue;
    const result = await prisma.contact.updateMany({
      where: {
        integrityLeadStage: mapping.code,
        stage: "NEW_LEAD",
      },
      data: { stage: mapping.pipelineStage },
    });
    updated += result.count;
  }

  revalidatePath("/contacts");
  revalidatePath("/settings/integrity-stages");
  revalidatePath("/");

  return { updated };
}
