"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { runMilestoneEmailCheck, type MilestoneEmailResult } from "@/lib/milestoneEmails";

export async function triggerMilestoneEmailCheck(): Promise<MilestoneEmailResult> {
  return runMilestoneEmailCheck();
}

export async function updateMilestoneTemplate(
  templateId: "day30" | "day60" | "day90" | "birthday",
  formData: FormData
) {
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) {
    throw new Error("Subject and body are required");
  }

  await prisma.milestoneEmailTemplate.update({
    where: { id: templateId },
    // Only the birthday email has an on/off switch.
    data: { subject, body, ...(templateId === "birthday" ? { enabled: formData.get("enabled") === "on" } : {}) },
  });

  revalidatePath("/settings/milestone-emails");
}
