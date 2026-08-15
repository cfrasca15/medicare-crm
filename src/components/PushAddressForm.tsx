"use client";

import { useState, useTransition } from "react";
import { pushContactAddressToIntegrity } from "@/lib/actions/integritySync";

export function PushAddressForm({
  contactId,
  defaultAddress1,
  defaultCity,
  defaultStateCode,
  defaultPostalCode,
}: {
  contactId: string;
  defaultAddress1?: string;
  defaultCity?: string;
  defaultStateCode?: string;
  defaultPostalCode?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const address1 = String(formData.get("address1") ?? "").trim();
        const city = String(formData.get("city") ?? "").trim();
        const stateCode = String(formData.get("stateCode") ?? "").trim();
        const postalCode = String(formData.get("postalCode") ?? "").trim();

        if (!address1 || !city || !stateCode || !postalCode) {
          setMessage("Address, city, state, and ZIP are required.");
          return;
        }

        setMessage(null);
        startTransition(async () => {
          try {
            await pushContactAddressToIntegrity(contactId, {
              address1,
              address2: String(formData.get("address2") ?? "").trim() || undefined,
              city,
              stateCode,
              postalCode,
              county: String(formData.get("county") ?? "").trim() || undefined,
              countyFips: String(formData.get("countyFips") ?? "").trim() || undefined,
            });
            setMessage("Address pushed to Integrity.");
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Push failed.");
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <PushField label="Address 1" name="address1" defaultValue={defaultAddress1} required />
        <PushField label="Address 2" name="address2" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <PushField label="City" name="city" defaultValue={defaultCity} required />
        <PushField label="State" name="stateCode" defaultValue={defaultStateCode} required />
        <PushField label="ZIP" name="postalCode" defaultValue={defaultPostalCode} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PushField label="County" name="county" />
        <PushField label="County FIPS" name="countyFips" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="btn-secondary">
          {isPending ? "Pushing…" : "Push Address to Integrity"}
        </button>
        {message && <span className="muted text-xs">{message}</span>}
      </div>
    </form>
  );
}

function PushField({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input id={name} name={name} defaultValue={defaultValue} required={required} className="field" />
    </div>
  );
}
