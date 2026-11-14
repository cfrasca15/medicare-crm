"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addGuestToContacts, setNotInterested } from "@/lib/actions/events";
import { Toast } from "@/components/Toast";

// What happens to a guest after the event: they become a contact, or they're
// marked not interested. Until then they stay on the follow-up list.
export function EventFollowUpButtons({
  guestId,
  contact,
  notInterested,
}: {
  guestId: string;
  contact: { id: string; name: string } | null;
  notInterested: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (contact) {
    return (
      <Link href={`/contacts/${contact.id}`} className="pill bg-emerald-50 text-emerald-700 hover:underline dark:bg-emerald-500/10 dark:text-emerald-300">
        In Contacts
      </Link>
    );
  }

  if (notInterested) {
    return (
      <span className="muted text-xs whitespace-nowrap">
        Not interested ·{" "}
        <button
          type="button"
          disabled={pending}
          className="link"
          onClick={() => startTransition(() => setNotInterested(guestId, false))}
        >
          Undo
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3 text-xs whitespace-nowrap">
      <button
        type="button"
        disabled={pending}
        className="link font-medium"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await addGuestToContacts(guestId);
            if ("error" in res) setError(res.error);
          });
        }}
      >
        {pending ? "Working…" : "Add to Contacts"}
      </button>
      <button
        type="button"
        disabled={pending}
        className="muted cursor-pointer hover:underline"
        onClick={() => startTransition(() => setNotInterested(guestId, true))}
      >
        Not interested
      </button>
      {error && <Toast message={error} error onClose={() => setError(null)} />}
    </span>
  );
}
