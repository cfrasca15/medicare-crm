"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncIntegrityLeads } from "@/lib/actions/integritySync";
import { Toast } from "@/components/Toast";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            try {
              const r = await syncIntegrityLeads();
              setResult({ text: `Synced from Integrity: ${r.imported} new, ${r.updated} updated.`, error: false });
              router.refresh();
            } catch (err) {
              setResult({ text: err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed.", error: true });
            }
          });
        }}
        className="btn-secondary"
      >
        {isPending ? "Syncing…" : "Sync from Integrity"}
      </button>
      {result && <Toast message={result.text} error={result.error} onClose={() => setResult(null)} />}
    </>
  );
}
