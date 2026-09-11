"use server";

import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PlanDocumentType } from "@/generated/prisma/client";
import { ensureUploadsDir, getUploadsDir } from "@/lib/storage";
import { revalidatePath } from "next/cache";

export async function uploadPlanDocument(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to upload");
  }

  const docType = String(formData.get("docType") ?? "");
  if (!Object.values(PlanDocumentType).includes(docType as PlanDocumentType)) {
    throw new Error("Choose a document type");
  }

  const carrier = emptyToNull(formData.get("carrier"));
  const planName = emptyToNull(formData.get("planName"));

  const dir = await ensureUploadsDir();
  const ext = path.extname(file.name);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  await prisma.planDocument.create({
    data: {
      carrier,
      planName,
      docType: docType as PlanDocumentType,
      fileName: file.name,
      storedName,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
    },
  });

  revalidatePath("/documents");
}

export async function deletePlanDocument(id: string) {
  const doc = await prisma.planDocument.delete({ where: { id } });
  await unlink(path.join(getUploadsDir(), doc.storedName)).catch(() => {
    // File already missing on disk — the index row is still gone, which is
    // what matters; nothing further to clean up.
  });
  revalidatePath("/documents");
}

function emptyToNull(value: FormDataEntryValue | null): string | undefined {
  const str = String(value ?? "").trim();
  return str.length ? str : undefined;
}
