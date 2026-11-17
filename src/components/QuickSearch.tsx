"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Hit = { id: string; name: string; detail: string };

// Pages and shortcuts you can jump to by typing part of the name. `words` are
// other things someone might type for the same place.
const PLACES: { href: string; label: string; words?: string }[] = [
  { href: "/", label: "Dashboard", words: "home" },
  { href: "/contacts", label: "Contacts", words: "clients leads people" },
  { href: "/contacts/new", label: "New contact", words: "add create client lead" },
  { href: "/contacts/import", label: "Import contacts", words: "csv upload spreadsheet" },
  { href: "/calendar", label: "Calendar", words: "appointments schedule" },
  { href: "/book", label: "Book appointment", words: "calendly schedule meeting" },
  { href: "/events", label: "Events", words: "seminar rsvp sign-in" },
  { href: "/events/follow-ups", label: "Event follow-ups", words: "rsvp guests" },
  { href: "/aep", label: "AEP Worklist", words: "annual enrollment review" },
  { href: "/tasks", label: "Tasks", words: "to do todo reminders follow-up" },
  { href: "/inbox", label: "Needs a Reply", words: "email gmail inbox" },
  { href: "/service", label: "Service Requests", words: "issues id card billing" },
  { href: "/alerts", label: "Change Alerts", words: "plan changes medical group" },
  { href: "/enrollments", label: "Enrollments", words: "applications policies" },
  { href: "/commissions", label: "Commissions", words: "statements paid money" },
  { href: "/book-of-business", label: "Book of Business", words: "plans doctors medical groups" },
  { href: "/lead-sources", label: "Lead Sources", words: "referrals marketing" },
  { href: "/birthdays", label: "Birthdays & Turning 65", words: "t65 birthday" },
  { href: "/settings", label: "Settings" },
  { href: "/settings/google", label: "Settings: Google", words: "gmail calendar connect" },
  { href: "/settings/milestone-emails", label: "Settings: Milestone, birthday & event emails", words: "automatic templates" },
  { href: "/settings/integrity-stages", label: "Settings: Integrity stages", words: "medicarecenter sync" },
  { href: "/settings/plan-names", label: "Settings: Carrier & plan names", words: "spelling rename" },
  { href: "/settings/duplicates", label: "Settings: Duplicates", words: "merge" },
];

// Places whose name (or one of its other words) has every word typed.
function matchPlaces(term: string) {
  const typed = term.toLowerCase().split(/\s+/).filter(Boolean);
  if (!typed.length) return [];
  return PLACES.filter((p) => {
    const text = `${p.label} ${p.words ?? ""}`.toLowerCase();
    return typed.every((w) => text.includes(w));
  }).slice(0, 5);
}

type Row = { key: string; href: string; title: string; detail?: string };

// "Search… Ctrl K" in the menu: jump to any contact or page from anywhere.
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

  // Contacts: search as you type, after a short pause.
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

  const term = q.trim();
  const places: Row[] = matchPlaces(term).map((p) => ({ key: `p-${p.href}`, href: p.href, title: p.label }));
  const contacts: Row[] = (term.length >= 2 ? hits : []).map((h) => ({
    key: `c-${h.id}`,
    href: `/contacts/${h.id}`,
    title: h.name,
    detail: h.detail,
  }));
  // One list for the arrow keys: contacts first (the usual reason to search), then pages.
  const rows = [...contacts, ...places];
  const current = Math.min(active, Math.max(0, rows.length - 1));

  const go = (row: Row | undefined) => {
    if (!row) return;
    close();
    router.push(row.href);
  };

  const group = (title: string, items: Row[], offset: number) =>
    items.length > 0 && (
      <>
        <li className="muted px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase">{title}</li>
        {items.map((row, i) => (
          <li key={row.key}>
            <button
              type="button"
              onMouseEnter={() => setActive(offset + i)}
              onClick={() => go(row)}
              className={`flex w-full cursor-pointer flex-col rounded-md px-3 py-2 text-left ${
                offset + i === current ? "bg-indigo-50 dark:bg-indigo-500/15" : ""
              }`}
            >
              <span className="text-sm font-medium">{row.title}</span>
              {row.detail && <span className="muted text-xs">{row.detail}</span>}
            </button>
          </li>
        ))}
      </>
    );

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

      {/* Drawn on the page itself, not inside the menu, so it sits in the
          middle of the screen rather than squeezed into the sidebar. */}
      {open &&
        createPortal(
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
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive(Math.min(current + 1, rows.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(current - 1, 0));
                } else if (e.key === "Enter") go(rows[current]);
              }}
              placeholder="Find a contact, or jump to a page"
              aria-label="Find a contact or page"
              className="w-full border-b border-slate-200 bg-transparent px-4 py-3 text-base outline-none dark:border-slate-800"
            />
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {group("Contacts", contacts, 0)}
              {group("Go to", places, contacts.length)}
              {term.length >= 2 && rows.length === 0 && (
                <li className="muted px-3 py-4 text-center text-sm">Nothing found.</li>
              )}
              {term.length < 2 && rows.length === 0 && (
                <li className="muted px-3 py-4 text-center text-sm">
                  Type a name, phone or email, or a page like &ldquo;commissions&rdquo;.
                </li>
              )}
            </ul>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
