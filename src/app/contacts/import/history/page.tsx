import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/date";
import type { ImportBatchContactLog } from "@/lib/actions/bulkImport";

export const dynamic = "force-dynamic";

export default async function ImportHistoryPage() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/contacts/import" className="link text-sm">
          ← Import Contacts
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Import History</h1>
        <p className="muted mt-1 text-sm">
          A record of every CSV upload that&apos;s been applied, and exactly
          what changed.
        </p>
      </div>

      {batches.length === 0 && (
        <p className="muted text-sm">No imports have been applied yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {batches.map((batch) => {
          const details: ImportBatchContactLog[] = JSON.parse(batch.detailsJson);
          return (
            <details key={batch.id} className="surface p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {formatDateTime(batch.createdAt)} — {batch.updatedCount} of{" "}
                {batch.rowCount} row(s) applied
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                {details.map((d) => (
                  <div key={d.contactId} className="border-t border-black/10 pt-3 text-sm dark:border-white/10">
                    <Link href={`/contacts/${d.contactId}`} className="link font-medium">
                      {d.contactName}
                    </Link>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {d.changes.map((c, i) => (
                        <li key={i} className="muted text-xs">
                          {c.label}: <span className="line-through">{c.oldValue}</span>{" "}
                          → <span className="font-medium">{c.newValue}</span>
                        </li>
                      ))}
                    </ul>
                    {d.pushResults.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {d.pushResults.map((p, i) => (
                          <li
                            key={i}
                            className={
                              p.ok
                                ? "muted text-xs"
                                : "text-xs text-red-600 dark:text-red-400"
                            }
                          >
                            {p.label}: {p.ok ? "pushed to Integrity" : `failed — ${p.error}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
