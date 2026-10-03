"use client";

import { useState, useTransition } from "react";
import { pushContactInfoToIntegrity } from "@/lib/actions/integritySync";

export function PushToIntegrityButton({ contactId }: { contactId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary"
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const res = await pushContactInfoToIntegrity(contactId);
            setResult(
              "error" in res && res.error
                ? { ok: false, text: res.error }
                : { ok: true, text: ("message" in res && res.message) || "Pushed." }
            );
          })
        }
      >
        {pending ? "Pushing…" : "Push Client Info to Integrity"}
      </button>
      {result && (
        <span
          className={
            result.ok
              ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {result.ok ? "✓ " : ""}
          {result.text}
        </span>
      )}
    </div>
  );
}
