"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = { id: string; name: string; detail: string };

// "Search… Ctrl K" in the menu: jump to any contact from any page.
export function QuickSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K opens it from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Search as you type, after a short pause.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setHits(await res.json());
          setActive(0);
        }
      } catch {
        // a newer search replaced this one
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const close = () => {
    setOpen(false);
    setQ("");
    setHits([]);
  };
  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    close();
    router.push(`/contacts/${hit.id}`);
  };
  const shown = q.trim().length >= 2 ? hits : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="flex-1">Search…</span>
        <kbd className="rounded border border-slate-300 px-1.5 text-[10px] dark:border-slate-600">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/30 p-4 pt-[12vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="surface w-full max-w-lg overflow-hidden shadow-2xl">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, shown.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") go(shown[active]);
              }}
              placeholder="Find a contact by name, phone or email"
              aria-label="Find a contact"
              className="w-full border-b border-slate-200 bg-transparent px-4 py-3 text-base outline-none dark:border-slate-800"
            />
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {shown.map((h, i) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={`flex w-full cursor-pointer flex-col rounded-md px-3 py-2 text-left ${
                      i === active ? "bg-indigo-50 dark:bg-indigo-500/15" : ""
                    }`}
                  >
                    <span className="text-sm font-medium">{h.name}</span>
                    {h.detail && <span className="muted text-xs">{h.detail}</span>}
                  </button>
                </li>
              ))}
              {q.trim().length >= 2 && shown.length === 0 && (
                <li className="muted px-3 py-4 text-center text-sm">No contacts found.</li>
              )}
              {q.trim().length < 2 && <li className="muted px-3 py-4 text-center text-sm">Type at least 2 letters.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
