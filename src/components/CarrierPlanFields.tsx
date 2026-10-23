"use client";

import { useId, useState } from "react";

const OTHER = "__other";

// Carrier as a dropdown of standard names (or "Other…" to type one), and Plan
// Name with suggestions for the chosen carrier only.
export function CarrierPlanFields({
  carriers,
  plansByCarrier,
  defaultCarrier = "",
  defaultPlan = "",
  labelClass = "text-sm font-medium",
  idPrefix,
}: {
  carriers: string[];
  plansByCarrier: Record<string, string[]>;
  defaultCarrier?: string;
  defaultPlan?: string;
  labelClass?: string;
  idPrefix: string;
}) {
  const known = defaultCarrier === "" || carriers.includes(defaultCarrier);
  const [carrier, setCarrier] = useState(defaultCarrier);
  const [other, setOther] = useState(!known);
  const listId = useId();
  const plans = plansByCarrier[carrier] ?? [];

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className={labelClass} htmlFor={`${idPrefix}-carrier`}>
          Carrier <span className="text-red-500">*</span>
        </label>
        {other ? (
          <div className="flex items-center gap-2">
            <input
              id={`${idPrefix}-carrier`}
              name="carrier"
              required
              defaultValue={known ? "" : defaultCarrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Carrier name"
              className="field w-full"
            />
            <button
              type="button"
              onClick={() => {
                setOther(false);
                setCarrier("");
              }}
              className="link text-xs whitespace-nowrap"
            >
              Pick from list
            </button>
          </div>
        ) : (
          <select
            id={`${idPrefix}-carrier`}
            name="carrier"
            required
            defaultValue={known ? defaultCarrier : ""}
            onChange={(e) => {
              if (e.target.value === OTHER) {
                setOther(true);
                setCarrier("");
              } else setCarrier(e.target.value);
            }}
            className="field"
          >
            <option value="" disabled>
              Choose a carrier
            </option>
            {carriers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
          </select>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass} htmlFor={`${idPrefix}-planName`}>
          Plan Name <span className="text-red-500">*</span>
        </label>
        <input
          id={`${idPrefix}-planName`}
          name="planName"
          required
          defaultValue={defaultPlan}
          list={listId}
          autoComplete="off"
          placeholder={carrier ? `Start typing a ${carrier} plan` : "Choose the carrier first"}
          className="field"
        />
        <datalist id={listId}>
          {plans.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
    </>
  );
}
