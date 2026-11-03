"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addContactToGoogle, linkContactToGoogle, setGoogleSyncSkip } from "@/lib/actions/googleContacts";
import type { PushResult } from "@/lib/googleContactsSync";
import type { GoogleCandidate } from "@/lib/googleContactsMatch";

type Review = { reason: string; candidates: GoogleCandidate[] };

// A contact's place in Google Contacts: a link to their card, "Add to Google
// Contacts", or, when Google has someone who might be them, the choice of
// linking to that card, adding them as new, or leaving them out of Google.
// Also used for each row of the review list on Settings → Google.
export function GoogleContactButton({
  contactId,
  resourceName,
  skipped,
  review: savedReview,
}: {
  contactId: string;
  resourceName: string | null;
  skipped: boolean;
  review: Review | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [review, setReview] = useState<Review | null>(savedReview);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = (fn: () => Promise<PushResult | void>) =>
    startTransition(async () => {
      setMessage(null);
      const res = await fn();
      if (res?.review) setReview(res.review);
      else if (res?.error) setMessage({ text: res.error, error: true });
      else {
        if (res?.message) setMessage({ text: res.message, error: false });
        setReview(null);
        router.refresh();
      }
    });

  const note = message && (
    <span className={`text-xs ${message.error ? "text-red-600 dark:text-red-400" : "muted"}`}>{message.text}</span>
  );

  if (review) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div>
          <span className="font-medium">Already in Google?</span> <span className="muted">{review.reason}:</span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {review.candidates.map((g) => (
            <li key={g.resourceName} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{g.name}</span>
              <span className="muted text-xs">
                {[...g.phones, ...g.emails].join(" · ") || "no phone or email"} ({g.why})
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => linkContactToGoogle(contactId, g.resourceName))}
                className="btn-secondary px-2 py-0.5 text-xs"
              >
                That&apos;s them
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => addContactToGoogle(contactId, true))}
            className="btn-secondary px-2 py-0.5 text-xs"
          >
            {isPending ? "Working…" : "None of these: add as new"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => setGoogleSyncSkip(contactId, true))}
            className="muted text-xs hover:underline"
          >
            Leave out of Google
          </button>
          {note}
        </div>
      </div>
    );
  }

  if (resourceName) {
    return (
      <span className="flex items-center gap-2">
        <a
          href={`https://contacts.google.com/person/${resourceName.replace("people/", "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 hover:underline dark:bg-sky-500/15 dark:text-sky-200"
          title="Open their card in Google Contacts"
        >
          In Google Contacts ↗
        </a>
        {note}
      </span>
    );
  }

  if (skipped) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="muted">Left out of Google Contacts</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => setGoogleSyncSkip(contactId, false))}
          className="link"
        >
          Undo
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => addContactToGoogle(contactId))}
        className="link text-xs"
        title="Add them to your Google contacts, or link them to the card already there"
      >
        {isPending ? "Adding…" : "Add to Google Contacts"}
      </button>
      {note}
    </span>
  );
}
