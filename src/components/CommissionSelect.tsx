"use client";

import { useEffect, useRef, useState } from "react";
import { ratesForCarrier } from "@/lib/commissionRates";

const OTHER = "other";

// Commission Amount for the Add Policy form: the 2027 amounts for whatever is
// typed in the same form's Carrier box, or "Other amount…" for anything else.
export function CommissionSelect({
  id,
  name,
  initialCarrier = "",
  defaultAmount = null,
}: {
  id?: string;
  name: string;
  initialCarrier?: string;
  defaultAmount?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [carrier, setCarrier] = useState(initialCarrier);
  // A saved amount that isn't on the carrier's list opens in the number box.
  const listed = defaultAmount == null || ratesForCarrier(initialCarrier).some((r) => r.amount === defaultAmount);
  const [other, setOther] = useState(!listed);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const input = form.elements.namedItem("carrier");
      setCarrier(input instanceof HTMLInputElement ? input.value : "");
    };
    const onReset = () => {
      setOther(false);
      setTimeout(read, 0);
    };
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
      form.removeEventListener("reset", onReset);
    };
  }, []);

  const rates = ratesForCarrier(carrier);

  return (
    <div ref={ref}>
      {other ? (
        <div className="flex items-center gap-2">
          <input
            id={id}
            name={name}
            type="number"
            step="0.01"
            placeholder="Amount"
            defaultValue={defaultAmount ?? undefined}
            className="field w-full"
          />
          <button type="button" onClick={() => setOther(false)} className="link text-xs whitespace-nowrap">
            Pick from list
          </button>
        </div>
      ) : (
        <select
          id={id}
          name={name}
          defaultValue={defaultAmount != null && listed ? String(defaultAmount) : ""}
          onChange={(e) => {
            if (e.target.value === OTHER) setOther(true);
          }}
          className="field w-full"
        >
          <option value="">{carrier.trim() ? "Not set" : "Enter the carrier first, or pick Other"}</option>
          {rates.map((r) => (
            <option key={r.label} value={String(r.amount)}>
              ${r.amount.toLocaleString("en-US")} — {r.label}
            </option>
          ))}
          <option value={OTHER}>Other amount…</option>
        </select>
      )}
    </div>
  );
}
