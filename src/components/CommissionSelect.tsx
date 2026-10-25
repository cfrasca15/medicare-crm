"use client";

import { useEffect, useRef, useState } from "react";
import { canonicalCarrier, planKey } from "@/lib/carrierNames";
import type { CommissionChoices, RateOption } from "@/lib/compassCommissions";

const OTHER = "other";

// Commission Amount on the plan forms: the amounts for whatever carrier is in
// the same form's Carrier box (from Agent Compass's Commissions page, or the
// built-in list if it can't be reached), or "Other amount…" for anything else.
// Warns when Agent Compass marks the chosen plan as non-commissionable.
export function CommissionSelect({
  id,
  name,
  choices,
  county = null,
  initialCarrier = "",
  initialPlan = "",
  defaultAmount = null,
}: {
  id?: string;
  name: string;
  choices: CommissionChoices;
  county?: string | null;
  initialCarrier?: string;
  initialPlan?: string;
  defaultAmount?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [carrier, setCarrier] = useState(initialCarrier);
  const [plan, setPlan] = useState(initialPlan);

  const ratesFor = (c: string): RateOption[] =>
    c.trim() ? (choices.byCarrier[canonicalCarrier(c)] ?? choices.standard) : [];
  // A saved amount that isn't on the carrier's list opens in the number box.
  const listed = defaultAmount == null || defaultAmount === 0 || ratesFor(initialCarrier).some((r) => r.amount === defaultAmount);
  const [other, setOther] = useState(!listed);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const value = (n: string) => {
      const input = form.elements.namedItem(n);
      return input instanceof HTMLInputElement || input instanceof HTMLSelectElement ? input.value : "";
    };
    const read = () => {
      setCarrier(value("carrier"));
      setPlan(value("planName"));
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

  const rates = ratesFor(carrier);
  const c = carrier.trim() ? canonicalCarrier(carrier) : "";
  const flag =
    c && plan.trim()
      ? choices.flags.find(
          (f) =>
            f.carrier === c &&
            ((f.planId && plan.toUpperCase().includes(f.planId.toUpperCase())) || (f.planKey && planKey(plan) === f.planKey)) &&
            (!f.county || !county || f.county === county)
        )
      : undefined;

  return (
    <div ref={ref} className="flex flex-col gap-1">
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
          {flag?.zero && <option value="0">$0 — Non-commissionable (Agent Compass)</option>}
          {rates.map((r) => (
            <option key={`${r.label}|${r.amount}`} value={String(r.amount)}>
              ${r.amount.toLocaleString("en-US")} — {r.label}
            </option>
          ))}
          <option value={OTHER}>Other amount…</option>
        </select>
      )}
      {flag && (
        <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          Agent Compass: {flag.label}
        </p>
      )}
      {choices.source === "compass" && carrier.trim() && !choices.byCarrier[c] && (
        <p className="muted text-xs">Agent Compass has no schedule for {c} yet: showing the CMS maximum.</p>
      )}
    </div>
  );
}
