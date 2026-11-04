"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { restoreIntegrityLead } from "@/lib/actions/integritySync";

// Brings a lead that was merged away back in from Integrity as its own contact.
export function RestoreIntegrityLeadButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; id?: string; name?: string } | null>(null);

  if (result?.id) {
    return (
      <Link href={`/contacts/${result.id}`} className="link text-sm">
        Back as {result.name} →
      </Link>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => setResult(await restoreIntegrityLead(leadId)))}
        className="btn-secondary"
      >
        {isPending ? "Bringing back…" : "Bring back"}
      </button>
      {result?.error && <span className="text-xs text-red-600 dark:text-red-400">{result.error}</span>}
    </div>
  );
}
