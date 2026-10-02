// Loads parsed carrier formularies from formulary-data/*.json into the
// database. Safe to re-run: a formulary with the same carrier + name + year
// is deleted (with its drugs and plan links) and replaced.
//
// Run INSIDE the running container (needs the real DATABASE_URL):
//
//   docker exec medicare-crm node scripts/import-formularies.mjs
//
// or locally:  node scripts/import-formularies.mjs
//
// Each JSON file looks like:
//   { "carrier": "SCAN", "name": "SCAN California 2027", "year": 2027,
//     "sourceNote": "...", "plans": [{ "planName": "SCAN Classic (HMO)", "county": null }],
//     "drugs": [{ "name": "...", "isBrand": true, "tier": 3, "limits": "PA", "category": "...", "subcategory": "..." }] }

import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "formulary-data");
const dbUrl = process.env.DATABASE_URL ?? "file:/app/data/prod.db";
const client = createClient({ url: dbUrl });

const files = (await readdir(dataDir)).filter((f) => f.endsWith(".json")).sort();
if (files.length === 0) {
  console.error(`No .json files in ${dataDir}`);
  process.exit(1);
}

for (const file of files) {
  const f = JSON.parse(await readFile(path.join(dataDir, file), "utf-8"));

  const existing = await client.execute({
    sql: "SELECT id FROM Formulary WHERE carrier = ? AND name = ? AND year = ?",
    args: [f.carrier, f.name, f.year],
  });
  for (const row of existing.rows) {
    const id = String(row.id);
    await client.batch(
      [
        { sql: "DELETE FROM FormularyDrug WHERE formularyId = ?", args: [id] },
        { sql: "DELETE FROM FormularyPlan WHERE formularyId = ?", args: [id] },
        { sql: "DELETE FROM Formulary WHERE id = ?", args: [id] },
      ],
      "write"
    );
  }

  const formularyId = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO Formulary (id, carrier, name, year, sourceNote) VALUES (?, ?, ?, ?, ?)",
    args: [formularyId, f.carrier, f.name, f.year, f.sourceNote ?? null],
  });

  await client.batch(
    (f.plans ?? []).map((p) => ({
      sql: "INSERT INTO FormularyPlan (id, formularyId, planName, county) VALUES (?, ?, ?, ?)",
      args: [crypto.randomUUID(), formularyId, p.planName, p.county ?? null],
    })),
    "write"
  );

  const CHUNK = 500;
  for (let i = 0; i < f.drugs.length; i += CHUNK) {
    await client.batch(
      f.drugs.slice(i, i + CHUNK).map((d) => ({
        sql: `INSERT INTO FormularyDrug (id, formularyId, name, isBrand, tier, limits, category, subcategory)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          formularyId,
          d.name,
          d.isBrand ? 1 : 0,
          d.tier,
          d.limits ?? "",
          d.category ?? null,
          d.subcategory ?? null,
        ],
      })),
      "write"
    );
  }

  console.log(`Imported ${f.carrier} / ${f.name}: ${f.drugs.length} drugs, ${(f.plans ?? []).length} plans`);
}
