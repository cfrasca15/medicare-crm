"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { mergeContacts } from "@/lib/actions/merge";

type Row = {
  id: string;
  name: string;
  firstName: string;
  detail: string;
};

const first = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().split(/\s+/)[0] ?? "";

// One group of possible duplicates: pick which to keep and which to merge in.
export function MergeGroup({ reasons, rows }: { reasons: string[]; rows: Row[] }) {
  const [keep, setKeep] = useState(rows[0].id);
  // Only same-first-name rows start ticked: a shared phone or email with a
  // different first name is usually a spouse, not a duplicate.
  const [merge, setMerge] = useState<Set<string>>(
    new Set(rows.slice(1).filter((r) => first(r.firstName) === first(rows[0].firstName)).map((r) => r.id))
  );
  const household = new Set(rows.map((r) => first(r.firstName))).size > 1;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const toMerge = [...merge].filter((id) => id !== keep);
  const keepName = rows.find((r) => r.id === keep)?.name;

  return (
    <section className="surface flex flex-col gap-3 p-4 text-sm">
      <div className="muted text-xs">{reasons.join(" · ")}</div>
      {household && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          Different first names: this may be a couple sharing a phone or email. Only merge if it&apos;s the
          same person (you can link spouses on the contact page instead).
        </p>
      )}
      <table className="w-full">
        <thead>
          <tr className="muted text-left text-xs">
            <th className="pb-1 font-medium">Keep</th>
            <th className="pb-1 font-medium">Merge in</th>
            <th className="pb-1 font-medium">Contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="w-12 py-2">
                <input
                  type="radio"
                  name={`keep-${rows[0].id}`}
                  checked={keep === r.id}
                  onChange={() => setKeep(r.id)}
                  aria-label={`Keep ${r.name}`}
                  className="accent-indigo-600"
                />
              </td>
              <td className="w-20 py-2">
                <input
                  type="checkbox"
                  disabled={keep === r.id}
                  checked={keep !== r.id && merge.has(r.id)}
                  onChange={(e) => {
                    const next = new Set(merge);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    setMerge(next);
                  }}
                  aria-label={`Merge ${r.name}`}
                  className="h-4 w-4 accent-indigo-600"
                />
              </td>
              <td className="py-2">
                <Link href={`/contacts/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <div className="muted text-xs">{r.detail}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isPending || toMerge.length === 0}
          onClick={() => {
            if (!confirm(`Merge ${toMerge.length} contact(s) into ${keepName}? This can't be undone.`)) return;
            startTransition(async () => {
              const res = await mergeContacts(keep, toMerge);
              setMessage(res.error ?? null);
            });
          }}
          className="btn-primary"
        >
          {isPending ? "Merging…" : `Merge ${toMerge.length} into ${keepName}`}
        </button>
        {message && <span className="text-sm text-red-600 dark:text-red-400">{message}</span>}
      </div>
    </section>
  );
}
