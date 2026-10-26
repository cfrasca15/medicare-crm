"use client";

import { useState, useTransition } from "react";
import { setAepStatus } from "@/lib/actions/aep";
import { AEP_STATUSES } from "@/lib/aepStatuses";

export function AepStatusSelect({
  contactId,
  year,
  status,
  autoReason,
}: {
  contactId: string;
  year: number;
  status: string;
  autoReason: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <select
        defaultValue={status}
        disabled={isPending}
        aria-label="AEP status"
        onChange={(e) => {
          const value = e.target.value;
          setError(null);
          startTransition(async () => {
            const result = await setAepStatus(contactId, year, value);
            if (result?.error) setError(result.error);
          });
        }}
        className="field w-full py-1.5"
      >
        {AEP_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {error ? (
        <div className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</div>
      ) : (
        autoReason && <div className="muted mt-1 text-xs">{autoReason}</div>
      )}
    </div>
  );
}
