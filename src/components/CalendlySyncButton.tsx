"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncCalendlyEvents } from "@/lib/actions/calendlySync";

export function CalendlySyncButton() {
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
              const result = await syncCalendlyEvents();
              setMessage(
                `${result.tasksCreated} tasks created, ${result.contactsCreated} contacts created, ${result.skipped} already synced.`
              );
              router.refresh();
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Sync failed.");
            }
          });
        }}
        className="btn-secondary"
      >
        {isPending ? "Syncing…" : "Sync from Calendly"}
      </button>
      {message && <span className="muted text-xs">{message}</span>}
    </div>
  );
}
