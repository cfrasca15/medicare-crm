"use client";

import { useSyncExternalStore } from "react";

// The contact page's history, with a switch between everything and just the
// notes, calls and service updates (the things a person wrote). The choice
// is remembered in this browser.
//
// The rows are drawn by the page; ones that were logged automatically carry
// a class there (AUTO_ROW) that hides them while "Notes and calls" is picked.

type Show = "all" | "talk";
const KEY = "crm-activity-show";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): Show {
  try {
    return localStorage.getItem(KEY) === "talk" ? "talk" : "all";
  } catch {
    return "all"; // private window, or storage turned off
  }
}

export function ActivityTimeline({
  total,
  talkCount,
  children,
}: {
  total: number;
  talkCount: number; // how many rows are notes, calls or service updates
  children: React.ReactNode;
}) {
  const show = useSyncExternalStore(subscribe, read, () => "all" as Show);
  const pick = (next: Show) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // not remembered, but still switches below
    }
    listeners.forEach((fn) => fn());
  };

  const chip = (value: Show, label: string) => (
    <button
      type="button"
      onClick={() => pick(value)}
      aria-pressed={show === value}
      className={`pill cursor-pointer px-2.5 py-1 ${
        show === value
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {total > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {chip("all", `Everything · ${total}`)}
          {chip("talk", `Notes and calls · ${talkCount}`)}
        </div>
      )}
      <ol
        data-show={show}
        className="group/timeline relative flex flex-col gap-2 border-l border-slate-200 pl-4 dark:border-slate-800"
      >
        {children}
        {show === "talk" && talkCount === 0 && total > 0 && <li className="muted text-sm">No notes or calls yet.</li>}
      </ol>
    </>
  );
}
