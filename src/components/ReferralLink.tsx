"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { searchSpouseCandidates, type SpouseMatch } from "@/lib/actions/spouse";
import { setReferredBy } from "@/lib/actions/referrals";

// "Referred by" on the contact header: shows the referrer, or a search to set one.
export function ReferralLink({
  contactId,
  referrer,
}: {
  contactId: string;
  referrer: { id: string; name: string } | null;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SpouseMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (referrer && !picking) {
    return (
      <span className="flex items-center gap-2">
        <span className="muted">Referred by</span>
        <Link href={`/contacts/${referrer.id}`} target="_top" className="link font-medium">
          {referrer.name}
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => void (await setReferredBy(contactId, null)))}
          className="btn-danger-text text-xs"
        >
          Remove
        </button>
      </span>
    );
  }

  if (!picking) {
    return (
      <button type="button" onClick={() => setPicking(true)} className="link text-sm">
        + Referred by
      </button>
    );
  }

  return (
    <div className="surface flex w-full max-w-md flex-col gap-2 p-3 text-sm">
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
          placeholder="Who referred them?"
          aria-label="Referred by"
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
                    const res = await setReferredBy(contactId, m.id);
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
