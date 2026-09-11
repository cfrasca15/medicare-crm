import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getUploadsDir } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doc = await prisma.planDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(path.join(getUploadsDir(), doc.storedName));
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      "Content-Length": String(doc.fileSize),
    },
  });
}
