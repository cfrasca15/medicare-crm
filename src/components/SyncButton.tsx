"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncIntegrityLeads } from "@/lib/actions/integritySync";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              const result = await syncIntegrityLeads();
              setMessage(
                `Synced: ${result.imported} imported, ${result.updated} updated.`
              );
              router.refresh();
            } catch (err) {
              setMessage(
                err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed."
              );
            }
          });
        }}
        className="btn-secondary"
      >
        {isPending ? "Syncing…" : "Sync from Integrity"}
      </button>
      {message && (
        <span className="muted max-w-md truncate text-xs" title={message}>
          {message}
        </span>
      )}
    </div>
  );
}
