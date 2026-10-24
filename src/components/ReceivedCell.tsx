"use client";

import { useState, useTransition } from "react";
import { updateCommissionReceived } from "@/lib/actions/policies";

// Commission actually received for a plan, typed straight into the table.
export function ReceivedCell({
  contactId,
  policyId,
  defaultValue,
  expected,
}: {
  contactId: string;
  policyId: string;
  defaultValue: number | null;
  expected: number | null;
}) {
  const initial = defaultValue == null ? "" : String(defaultValue);
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const n = value.trim() === "" ? null : Number(value);
  const short = n != null && expected != null && n < expected;

  return (
    <input
      type="number"
      step="0.01"
      inputMode="decimal"
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => {
        const current = e.currentTarget.value;
        if (current === saved) return;
        startTransition(async () => {
          await updateCommissionReceived(contactId, policyId, current.trim() === "" ? null : Number(current));
          setSaved(current);
        });
      }}
      placeholder="—"
      title={short ? `Short by $${(expected! - n!).toFixed(2)}` : "Commission received"}
      aria-label="Commission received"
      className={`w-24 rounded border border-transparent px-2 py-1 text-right text-sm tabular-nums transition-colors outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:hover:border-slate-700 ${
        n != null && n < 0 ? "text-red-600 dark:text-red-400" : short ? "text-amber-600 dark:text-amber-400" : ""
      }`}
    />
  );
}
