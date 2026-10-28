"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkContactToIntegrity, sendContactToIntegrity } from "@/lib/actions/integritySync";
import { SyncContactButton } from "@/components/SyncContactButton";

type Match = { leadId: string; name: string; why: string };

// Creates this contact as a lead in Integrity (MedicareCENTER). If someone
// there looks like the same person, offers to link to them instead. Once
// linked it becomes the Sync button, keeping the result message showing.
export function SendToIntegrityButton({ contactId, linked }: { contactId: string; linked: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [match, setMatch] = useState<Match | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = (fn: () => Promise<{ error?: string; match?: Match; message?: string }>) =>
    startTransition(async () => {
      setMessage(null);
      const res = await fn();
      setMatch(res.match ?? null);
      if (res.error) setMessage({ text: res.error, error: true });
      else if (res.message) {
        setMessage({ text: res.message, error: false });
        router.refresh();
      }
    });

  const note = message && (
    <span className={`max-w-sm text-xs ${message.error ? "text-red-600 dark:text-red-400" : "muted"}`}>{message.text}</span>
  );

  if (linked) {
    return (
      <span className="flex items-center gap-2">
        <SyncContactButton contactId={contactId} />
        {note}
      </span>
    );
  }

  if (match) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span>
          Already in MedicareCENTER? <span className="font-medium">{match.name}</span>{" "}
          <span className="muted">({match.why})</span>
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => linkContactToIntegrity(contactId, match.leadId))}
          className="btn-primary"
        >
          {isPending ? "Working…" : "Link to them"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => sendContactToIntegrity(contactId, true))}
          className="btn-secondary"
        >
          Send as new
        </button>
        <button type="button" disabled={isPending} onClick={() => setMatch(null)} className="muted text-xs hover:underline">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => sendContactToIntegrity(contactId))}
        className="btn-secondary whitespace-nowrap"
        title="Create this client as a lead in Integrity, so they show up in MedicareCENTER"
      >
        {isPending ? "Sending…" : "Send to MedicareCENTER"}
      </button>
      {note}
    </span>
  );
}
