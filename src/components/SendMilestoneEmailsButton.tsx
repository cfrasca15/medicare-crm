"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triggerMilestoneEmailCheck } from "@/lib/actions/milestoneEmails";

export function SendMilestoneEmailsButton() {
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
              const result = await triggerMilestoneEmailCheck();
              const errorNote =
                result.errors.length > 0
                  ? ` (${result.errors.length} error${result.errors.length === 1 ? "" : "s"}: ${result.errors
                      .map((e) => `${e.contactName} — ${e.error}`)
                      .join("; ")})`
                  : "";
              setMessage(`Sent ${result.sent}, skipped ${result.skipped}.${errorNote}`);
              router.refresh();
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Check failed.");
            }
          });
        }}
        className="btn-secondary"
      >
        {isPending ? "Checking…" : "Run Check Now"}
      </button>
      {message && (
        <span className="muted max-w-lg text-xs" title={message}>
          {message}
        </span>
      )}
    </div>
  );
}
