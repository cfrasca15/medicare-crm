"use client";

import { useState, useTransition } from "react";
import { updatePolicyDoctorInfo } from "@/lib/actions/policies";

export function EditablePolicyCell({
  contactId,
  policyId,
  field,
  defaultValue,
}: {
  contactId: string;
  policyId: string;
  field: "doctor" | "medicalGroup";
  defaultValue: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [isPending, startTransition] = useTransition();

  return (
    <input
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => {
        const current = e.target.value;
        if (current === (defaultValue ?? "")) return;
        startTransition(() => {
          updatePolicyDoctorInfo(contactId, policyId, { [field]: current });
        });
      }}
      placeholder="—"
      className="w-full rounded border border-transparent px-2 py-1 text-sm transition-colors outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:hover:border-slate-700"
    />
  );
}
