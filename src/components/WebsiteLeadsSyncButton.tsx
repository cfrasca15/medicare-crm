"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncWebsiteLeads } from "@/lib/actions/websiteLeadsSync";

export function WebsiteLeadsSyncButton() {
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
              const r = await syncWebsiteLeads();
              if (!r.ok) {
                setMessage(r.error);
                return;
              }
              const parts = [
                `${r.imported} new leads`,
                `${r.matched} matched existing contacts`,
              ];
              if (r.skipped) parts.push(`${r.skipped} skipped`);
              if (r.cleanupFailed)
                parts.push(`${r.cleanupFailed} couldn't be cleared from Airtable (safe to run again)`);
              setMessage(parts.join(", ") + ".");
              router.refresh();
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Sync failed.");
            }
          });
        }}
        className="btn-secondary"
      >
        {isPending ? "Syncing…" : "Sync website leads"}
      </button>
      {message && <span className="muted text-xs">{message}</span>}
    </div>
  );
}
