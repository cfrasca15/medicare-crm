"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncIntegrityContact } from "@/lib/actions/integritySync";

// Pulls this one contact's latest details from Integrity.
export function SyncContactButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const res = await syncIntegrityContact(contactId);
            if (res.error) setMessage(res.error);
            else {
              setMessage("Updated ✓");
              router.refresh();
            }
          })
        }
        className="btn-secondary"
        title="Pull this contact's latest details from Integrity"
      >
        {isPending ? "Syncing…" : "Sync from Integrity"}
      </button>
      {message && <span className="muted text-xs">{message}</span>}
    </span>
  );
}
