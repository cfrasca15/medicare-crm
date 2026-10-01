// Bulk-imports plan documents straight into the database and uploads
// folder, bypassing the web upload form — for batches too large to click
// through one at a time (e.g. a season's worth of carrier plan documents).
//
// Run INSIDE the running container, since it needs the real DATABASE_URL
// and a writable /app/data:
//
//   docker exec medicare-crm node scripts/import-documents.mjs manifest.json
//
// manifest.json is an array of entries, each either:
//   { "url": "https://...", "fileName": "...", "docType": "SOB", "carrier": "...", "planName": "..." }
// or (for a file already placed in the same directory as the manifest):
//   { "file": "local-name.pdf", "fileName": "...", "docType": "EOC", "carrier": "...", "planName": "..." }
//
// carrier/planName may be omitted (null) for general documents like a
// comparison spreadsheet. docType must be one of the PlanDocumentType enum
// values in prisma/schema.prisma.

import { createClient } from "@libsql/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const VALID_DOC_TYPES = new Set([
  "SOB",
  "EOC",
  "ANOC",
  "RATE_SHEET",
  "BENEFITS_HIGHLIGHT",
  "COMPARISON_SPREADSHEET",
  "OTHER",
]);

function guessMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".csv") return "text/csv";
  return "application/octet-stream";
}

async function main() {
  const manifestArg = process.argv[2];
  if (!manifestArg) {
    console.error("Usage: node import-documents.mjs <manifest.json>");
    process.exit(1);
  }

  const manifestPath = path.resolve(manifestArg);
  const manifestDir = path.dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

  const dbUrl = process.env.DATABASE_URL ?? "file:/app/data/prod.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  const uploadsDir = path.join(path.dirname(dbPath), "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const client = createClient({ url: dbUrl });

  let imported = 0;
  let skipped = 0;

  for (const entry of manifest) {
    const { url, file, fileName, docType, carrier, planName } = entry;
    const displayName = fileName ?? file ?? url?.split("/").pop() ?? "document";

    if (!VALID_DOC_TYPES.has(docType)) {
      console.error(`Skipping "${displayName}": invalid docType "${docType}"`);
      skipped++;
      continue;
    }

    let buffer;
    try {
      if (url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        buffer = Buffer.from(await res.arrayBuffer());
      } else if (file) {
        buffer = await readFile(path.join(manifestDir, file));
      } else {
        throw new Error('entry needs either "url" or "file"');
      }
    } catch (err) {
      console.error(`Skipping "${displayName}": ${err.message}`);
      skipped++;
      continue;
    }

    const ext = path.extname(displayName) || ".pdf";
    const storedName = `${crypto.randomUUID()}${ext}`;
    await writeFile(path.join(uploadsDir, storedName), buffer);

    await client.execute({
      sql: `INSERT INTO PlanDocument (id, carrier, planName, docType, fileName, storedName, fileSize, mimeType)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        carrier ?? null,
        planName ?? null,
        docType,
        displayName,
        storedName,
        buffer.length,
        guessMimeType(displayName),
      ],
    });

    console.log(`Imported: ${displayName} (${docType}, ${carrier ?? "—"} / ${planName ?? "—"})`);
    imported++;
  }

  console.log(`\nDone. Imported ${imported}, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
