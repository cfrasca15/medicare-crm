"use client";

import { useState, useTransition } from "react";
import { sendContactEmail } from "@/lib/actions/gmail";
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
          <div key={m.id} className="surface flex flex-col gap-0.5 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{m.subject}</span>
              <span className="muted text-xs">
                {new Date(m.date).toLocaleDateString()}
              </span>
            </div>
            <div className="muted text-xs">{m.isFromMe ? "You" : m.from}</div>
            <div className="muted text-xs">{m.snippet}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
