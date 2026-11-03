"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { previewContactsToGoogle } from "@/lib/actions/googleContacts";
import type { GoogleSyncResult } from "@/lib/googleContactsSync";

// Shows, in full, what a sync would do: who would be added, which Google card
// each client would be linked to, and why. Changes nothing in Google.
export function GoogleContactsPreview() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sync?: GoogleSyncResult; error?: string } | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setResult(null);
              const r = await previewContactsToGoogle();
              setResult(r);
              router.refresh();
            })
          }
          className="btn-secondary"
        >
          {isPending ? "Checking Google…" : "Preview (changes nothing)"}
        </button>
      </div>
      {result?.error && <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>}
      {result?.sync && <Report r={result.sync} />}
    </div>
  );
}

function Report({ r }: { r: GoogleSyncResult }) {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
      <p className="muted">
        Nothing has been changed in Google. A sync would do this (Need a look is listed below):
      </p>
      <Section title={`Would add as new (${r.added.length})`} empty="Nobody.">
        {r.added.map((a) => (
          <li key={a.id}>
            <ContactLink {...a} />
          </li>
        ))}
      </Section>
      <Section title={`Would link to the card already in Google (${r.linked.length})`} empty="Nobody.">
        {r.linked.map((l) => (
          <li key={l.id}>
            <ContactLink {...l} /> → <span className="font-medium">{l.google}</span>{" "}
            <span className="muted">({l.why})</span>
          </li>
        ))}
      </Section>
      {r.updated.length > 0 && (
        <Section title={`Already linked, would get a new phone or email (${r.updated.length})`} empty="">
          {r.updated.map((u) => (
            <li key={u.id}>
              <ContactLink {...u} /> <span className="muted">({u.details.join(", ")})</span>
            </li>
          ))}
        </Section>
      )}
      <p className="muted">
        {r.review.length} need a look · {r.unchanged} already linked and up to date
      </p>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <div className="font-medium">{title}</div>
      {children.length ? (
        <ul className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto">{children}</ul>
      ) : (
        <p className="muted mt-1">{empty}</p>
      )}
    </div>
  );
}

function ContactLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/contacts/${id}`} className="link">
      {name}
    </Link>
  );
}
