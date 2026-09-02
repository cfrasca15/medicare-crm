"use client";

import { useState, useTransition } from "react";
import { sendContactEmail, getContactEmailBody } from "@/lib/actions/gmail";
import type { GmailMessageSummary } from "@/lib/google";

export function EmailPanel({
  contactId,
  history,
}: {
  contactId: string;
  history: GmailMessageSummary[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const formData = new FormData(form);
          setMessage(null);
          startTransition(async () => {
            try {
              await sendContactEmail(contactId, formData);
              setMessage("Sent.");
              form.reset();
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Send failed.");
            }
          });
        }}
        className="flex flex-col gap-2"
      >
        <input name="subject" placeholder="Subject" required className="field" />
        <textarea name="body" placeholder="Message" rows={4} required className="field" />
        <div className="flex items-center gap-2">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Sending…" : "Send Email"}
          </button>
          {message && <span className="muted text-xs">{message}</span>}
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {history.length === 0 && <p className="muted text-sm">No email history found.</p>}
        {history.map((m) => (
          <EmailHistoryRow key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}

function EmailHistoryRow({ message: m }: { message: GmailMessageSummary }) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (body === null && !isPending) {
      setError(null);
      startTransition(async () => {
        try {
          setBody(await getContactEmailBody(m.id));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load message.");
        }
      });
    }
  }

  return (
    <div className="surface flex flex-col gap-0.5 px-3 py-2 text-sm">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full flex-col gap-0.5 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{m.subject}</span>
          <span className="muted text-xs">{new Date(m.date).toLocaleDateString()}</span>
        </div>
        <div className="muted text-xs">{m.isFromMe ? "You" : m.from}</div>
        {!expanded && <div className="muted text-xs">{m.snippet}</div>}
      </button>

      {expanded && (
        <div className="mt-1 whitespace-pre-wrap border-t border-black/10 pt-2 text-sm dark:border-white/10">
          {isPending && <span className="muted text-xs">Loading…</span>}
          {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
          {body}
        </div>
      )}
    </div>
  );
}
