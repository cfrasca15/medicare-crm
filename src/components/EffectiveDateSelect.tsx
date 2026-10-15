"use client";

import { useState } from "react";

const OTHER = "other";

// Policies start on the 1st of a month, so the usual choices are a short
// list; "Other date…" opens a normal date box for anything else (older
// policies being entered after the fact). Values are yyyy-mm-dd.
export function EffectiveDateSelect({
  id,
  name,
  choices,
  defaultValue = "",
}: {
  id?: string;
  name: string;
  choices: { value: string; label: string }[];
  defaultValue?: string;
}) {
  const known = defaultValue === "" || choices.some((c) => c.value === defaultValue);
  const [mode, setMode] = useState(known ? "list" : OTHER);

  if (mode === OTHER) {
    return (
      <div className="flex items-center gap-2">
        <input id={id} type="date" name={name} defaultValue={defaultValue} className="field" />
        <button type="button" onClick={() => setMode("list")} className="link text-xs whitespace-nowrap">
          Pick from list
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      name={name}
      defaultValue={known ? defaultValue : ""}
      onChange={(e) => {
        if (e.target.value === OTHER) setMode(OTHER);
      }}
      className="field"
    >
      <option value="">Not set</option>
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
      <option value={OTHER}>Other date…</option>
    </select>
  );
}
