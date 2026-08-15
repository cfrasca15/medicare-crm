"use client";

import { useState, useTransition } from "react";
import {
  pushContactEmailToIntegrity,
  pushContactPhoneToIntegrity,
} from "@/lib/actions/integritySync";

export function PushEmailPhoneForm({
  contactId,
  defaultEmail,
  defaultPhone,
}: {
  contactId: string;
  defaultEmail?: string;
  defaultPhone?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <PushField
        label="Email"
        defaultValue={defaultEmail}
        onPush={(value) => pushContactEmailToIntegrity(contactId, value)}
      />
      <PushField
        label="Phone"
        defaultValue={defaultPhone}
        onPush={(value) => pushContactPhoneToIntegrity(contactId, value)}
      />
    </div>
  );
}

function PushField({
  label,
  defaultValue,
  onPush,
}: {
  label: string;
  defaultValue?: string;
  onPush: (value: string) => Promise<unknown>;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const value = String(formData.get("value") ?? "").trim();
        if (!value) return;
        setMessage(null);
        startTransition(async () => {
          try {
            await onPush(value);
            setMessage(`${label} pushed.`);
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Push failed.");
          }
        });
      }}
      className="flex flex-col gap-1"
    >
      <label className="text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input name="value" defaultValue={defaultValue} className="field flex-1" />
        <button type="submit" disabled={isPending} className="btn-secondary">
          Push
        </button>
      </div>
      {message && <span className="muted text-xs">{message}</span>}
    </form>
  );
}
