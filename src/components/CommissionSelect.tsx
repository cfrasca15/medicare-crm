"use client";

import { useEffect, useRef, useState } from "react";
import { ratesForCarrier } from "@/lib/commissionRates";

const OTHER = "other";

// Commission Amount for the Add Policy form: the 2027 amounts for whatever is
// typed in the same form's Carrier box, or "Other amount…" for anything else.
export function CommissionSelect({ id, name }: { id?: string; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [carrier, setCarrier] = useState("");
  const [other, setOther] = useState(false);

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
          <input id={id} name={name} type="number" step="0.01" placeholder="Amount" className="field w-full" />
          <button type="button" onClick={() => setOther(false)} className="link text-xs whitespace-nowrap">
            Pick from list
          </button>
        </div>
      ) : (
        <select
          id={id}
          name={name}
          defaultValue=""
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
