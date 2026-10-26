"use client";

import { useState } from "react";

const TABS = [
  { key: "note", label: "Note" },
  { key: "call", label: "Log call" },
  { key: "request", label: "Service request" },
] as const;

// One box for adding to a contact's activity: a note, a call, or a new
// service request, picked with the tabs along the top.
export function ActivityComposer({
  note,
  call,
  request,
}: {
  note: React.ReactNode;
  call: React.ReactNode;
  request: React.ReactNode;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("note");
  return (
    <div className="surface p-3">
      <div role="tablist" className="mb-3 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "note" ? note : tab === "call" ? call : request}
    </div>
  );
}
