"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reapplyStageMappings } from "@/lib/actions/stageMappings";

export function ReapplyMappingsButton() {
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
              const result = await reapplyStageMappings();
              setMessage(`Moved ${result.updated} contact(s) that were still at New Lead.`);
              router.refresh();
            } catch (err) {
              setMessage(
                err instanceof Error ? `Failed: ${err.message}` : "Failed."
              );
            }
          });
        }}
        className="btn-secondary"
      >
        {isPending ? "Applying…" : "Apply to existing contacts"}
      </button>
      {message && (
        <span className="muted max-w-md truncate text-xs" title={message}>
          {message}
        </span>
      )}
    </div>
  );
}
