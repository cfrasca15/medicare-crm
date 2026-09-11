import { mkdir } from "node:fs/promises";
import path from "node:path";

// Files live next to the SQLite db in the same persistent Docker volume
// (crm-data:/app/data) rather than needing a separate volume — derived
// from DATABASE_URL so dev (a relative ./dev.db) and prod (/app/data/prod.db)
// both land somewhere sensible without a dedicated env var.
export function getUploadsDir(): string {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  return path.join(path.dirname(dbPath), "uploads");
}

export async function ensureUploadsDir(): Promise<string> {
  const dir = getUploadsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}
