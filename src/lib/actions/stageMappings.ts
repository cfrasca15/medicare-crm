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
