"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { linkSpouse, searchSpouseCandidates, unlinkSpouse, type SpouseMatch } from "@/lib/actions/spouse";

// Shows the linked spouse with a side-by-side button, or a search to link one.
export function SpouseLink({
  contactId,
  spouse,
}: {
  contactId: string;
  spouse: { id: string; name: string } | null;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SpouseMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (spouse && !picking) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="muted">Spouse:</span>
        <Link href={`/contacts/${spouse.id}`} target="_top" className="link font-medium">
          {spouse.name}
        </Link>
        <Link
          href={`/side-by-side?a=${contactId}&b=${spouse.id}`}
          target="_top"
          className="btn-secondary px-3 py-1 text-xs"
        >
          Open side by side
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => unlinkSpouse(contactId))}
          className="btn-danger-text text-xs"
        >
          Unlink
        </button>
      </div>
    );
  }

  if (!picking) {
    return (
      <button type="button" onClick={() => setPicking(true)} className="link mt-2 text-sm">
        + Link spouse
      </button>
    );
  }

  return (
    <div className="surface mt-2 flex max-w-md flex-col gap-2 p-3 text-sm">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          startTransition(async () => {
            const found = await searchSpouseCandidates(contactId, query);
            setMatches(found);
            if (found.length === 0) setMessage("No contacts match that name.");
          });
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Spouse's name"
          aria-label="Spouse's name"
          className="field flex-1"
        />
        <button type="submit" disabled={isPending || !query.trim()} className="btn-secondary">
          {isPending ? "Searching…" : "Search"}
        </button>
        <button type="button" onClick={() => setPicking(false)} className="muted text-xs hover:underline">
          Cancel
        </button>
      </form>
      {matches.length > 0 && (
        <ul className="flex flex-col gap-1">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await linkSpouse(contactId, m.id);
                    if (res?.error) setMessage(res.error);
                    else {
                      setPicking(false);
                      setMatches([]);
                      setQuery("");
                    }
                  })
                }
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="font-medium">{m.name}</span>
                {m.detail && <span className="muted ml-2 text-xs">{m.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="muted text-xs">{message}</p>}
    </div>
  );
}
