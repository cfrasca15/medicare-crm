"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  syncTaskToGoogleCalendar,
  removeTaskFromGoogleCalendar,
} from "@/lib/actions/googleCalendar";

export function CalendarSyncButton({
  taskId,
  synced,
}: {
  taskId: string;
  synced: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {message && <span className="muted text-xs">{message}</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              if (synced) {
                await removeTaskFromGoogleCalendar(taskId);
              } else {
                await syncTaskToGoogleCalendar(taskId);
              }
              router.refresh();
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Calendar sync failed.");
            }
          });
        }}
        className={synced ? "btn-secondary px-3 py-1.5 text-xs" : "link text-xs"}
      >
        {isPending
          ? "Working…"
          : synced
            ? "Remove from Calendar"
            : "Add to Calendar"}
      </button>
    </div>
  );
}
