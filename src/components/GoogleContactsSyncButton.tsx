"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { linkAllNameMatches, syncContactsToGoogle } from "@/lib/actions/googleContacts";
import type { GoogleSyncResult } from "@/lib/googleContactsSync";
import { Names } from "@/components/SyncButton";
import { Toast } from "@/components/Toast";

// Adds clients to Google Contacts (or links them to the card already there).
// Pass className to show it as a menu item.
export function GoogleContactsSyncButton({ className = "btn-secondary" }: { className?: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sync?: GoogleSyncResult; error?: string } | null>(null);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            const r = await syncContactsToGoogle();
            setResult(r);
            if (r.sync) router.refresh();
          });
        }}
        className={className}
      >
        {isPending ? "Syncing…" : "Sync to Google Contacts"}
      </button>
      {result && (
        <Toast
          message={result.sync ? <Summary r={result.sync} onNavigate={() => setResult(null)} /> : result.error}
          error={!!result.error}
          stay
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}

function Summary({ r, onNavigate }: { r: GoogleSyncResult; onNavigate: () => void }) {
  const total = r.added.length + r.linked.length + r.updated.length + r.review.length + r.failed.length + r.unchanged;
  const nothing = !r.added.length && !r.linked.length && !r.updated.length && !r.review.length && !r.failed.length;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium">
        Synced {total} client{total === 1 ? "" : "s"} to Google Contacts
      </div>
      {nothing ? (
        <div className="muted">Everyone was already in Google.</div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {r.added.length > 0 && (
            <li>
              <span className="font-medium">{r.added.length} added:</span> <Names items={r.added} onNavigate={onNavigate} />
            </li>
          )}
          {r.linked.length > 0 && (
            <li>
              <span className="font-medium">{r.linked.length} already in Google, now linked:</span>{" "}
              <Names items={r.linked} onNavigate={onNavigate} />
            </li>
          )}
          {r.updated.length > 0 && (
            <li>
              <span className="font-medium">{r.updated.length} with a new phone or email:</span>{" "}
              <Names items={r.updated} note={(u) => `(${u.details.join(", ")})`} onNavigate={onNavigate} />
            </li>
          )}
          {r.review.length > 0 && (
            <li>
              <span className="font-medium">{r.review.length} need a look:</span>{" "}
              <Link href="/settings/google#review" className="link" onClick={onNavigate}>
                pick their Google contact
              </Link>
            </li>
          )}
          {r.failed.length > 0 && (
            <li className="text-red-700 dark:text-red-300">
              <span className="font-medium">{r.failed.length} failed:</span>{" "}
              <Names items={r.failed} note={(f) => `(${f.error})`} onNavigate={onNavigate} />
            </li>
          )}
          <li className="muted">{r.unchanged} already up to date</li>
        </ul>
      )}
    </div>
  );
}

// Links every client whose only match is one Google contact with the same name.
export function LinkAllNameMatchesButton({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const router = useRouter();

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const r = await linkAllNameMatches();
            setMessage(
              r.errors.length
                ? { text: `Linked ${r.linked}; ${r.errors.length} failed: ${r.errors[0]}`, error: true }
                : { text: `Linked ${r.linked} ✓`, error: false }
            );
            router.refresh();
          })
        }
        className="btn-secondary"
      >
        {isPending ? "Linking…" : count === 1 ? "Link the 1 name match" : `Link all ${count} name matches`}
      </button>
      {message && (
        <span className={`text-xs ${message.error ? "text-red-600 dark:text-red-400" : "muted"}`}>{message.text}</span>
      )}
    </span>
  );
}
