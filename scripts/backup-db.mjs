// Writes a consistent copy of the CRM database to the given path while the
// app keeps running (SQLite's VACUUM INTO). Used by the nightly backup:
//   docker exec medicare-crm node scripts/backup-db.mjs /app/data/backup-tmp.db
import { createClient } from "@libsql/client";
import { existsSync, rmSync } from "node:fs";

const out = process.argv[2];
if (!out) {
  console.error("Usage: node scripts/backup-db.mjs <output-file>");
  process.exit(1);
}
if (existsSync(out)) rmSync(out);

const db = createClient({ url: process.env.DATABASE_URL });
await db.execute({ sql: "VACUUM INTO ?", args: [out] });
const { rows } = await db.execute("SELECT COUNT(*) AS n FROM Contact");
console.log(`Backed up ${rows[0].n} contacts to ${out}`);
