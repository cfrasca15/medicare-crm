"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncWebsiteLeads } from "@/lib/actions/websiteLeadsSync";
import { Toast } from "@/components/Toast";

// Pulls new leads from the website's Airtable. Shown as an item in the
// Contacts page's "More" menu (pass className to style it).
export function WebsiteLeadsSyncButton({ className = "btn-secondary" }: { className?: string }) {
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
              const r = await syncWebsiteLeads();
              if (!r.ok) {
                setResult({ text: r.error, error: true });
                return;
              }
              const parts = [`${r.imported} new leads`, `${r.matched} matched existing contacts`];
              if (r.skipped) parts.push(`${r.skipped} skipped`);
              if (r.cleanupFailed)
                parts.push(`${r.cleanupFailed} couldn't be cleared from Airtable (safe to run again)`);
              setResult({ text: `Website leads: ${parts.join(", ")}.`, error: false });
              router.refresh();
            } catch (err) {
              setResult({ text: err instanceof Error ? err.message : "Sync failed.", error: true });
            }
          });
        }}
        className={className}
      >
        {isPending ? "Syncing…" : "Sync website leads"}
      </button>
      {result && <Toast message={result.text} error={result.error} onClose={() => setResult(null)} />}
    </>
  );
}
