"use server";

import { prisma } from "@/lib/prisma";
import { PipelineStage } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function upsertStageMapping(formData: FormData) {
  const code = Number(formData.get("code"));
  const label = String(formData.get("label") ?? "").trim();
  const pipelineStageRaw = String(formData.get("pipelineStage") ?? "").trim();

  if (!Number.isInteger(code) || !label) {
    throw new Error("Code and label are required");
  }

  await prisma.integrityStageMapping.upsert({
    where: { code },
    create: {
      code,
      label,
      pipelineStage: pipelineStageRaw ? (pipelineStageRaw as PipelineStage) : undefined,
    },
    update: {
      label,
      pipelineStage: pipelineStageRaw ? (pipelineStageRaw as PipelineStage) : null,
    },
  });

  revalidatePath("/settings/integrity-stages");
}

export async function deleteStageMapping(code: number) {
  await prisma.integrityStageMapping.delete({ where: { code } });
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
