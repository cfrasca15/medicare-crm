"use client";

import { useState, useTransition } from "react";
import { pushContactMedicareInfoToIntegrity } from "@/lib/actions/integritySync";

export function PushMedicareInfoForm({
  contactId,
  defaultMedicareId,
  defaultPartADate,
  defaultPartBDate,
}: {
  contactId: string;
  defaultMedicareId?: string;
  defaultPartADate?: string;
  defaultPartBDate?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const medicareBeneficiaryId = String(formData.get("medicareId") ?? "").trim();
        const partA = String(formData.get("partA") ?? "").trim();
        const partB = String(formData.get("partB") ?? "").trim();
        setMessage(null);
        startTransition(async () => {
          try {
            await pushContactMedicareInfoToIntegrity(contactId, {
              medicareBeneficiaryId: medicareBeneficiaryId || undefined,
              partA: partA || undefined,
              partB: partB || undefined,
            });
            setMessage("Medicare info pushed.");
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Push failed.");
          }
        });
      }}
      className="flex flex-col gap-2"
    >
      <label className="text-sm font-medium">Medicare Info</label>
      <div className="grid grid-cols-3 gap-2">
        <input
          name="medicareId"
          defaultValue={defaultMedicareId}
          placeholder="Medicare Number"
          className="field"
        />
        <input name="partA" type="date" defaultValue={defaultPartADate} className="field" />
        <input name="partB" type="date" defaultValue={defaultPartBDate} className="field" />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={isPending} className="btn-secondary">
          Push
        </button>
        {message && <span className="muted text-xs">{message}</span>}
      </div>
    </form>
  );
}
