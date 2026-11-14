"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteEvent, finishAttendance, reopenAttendance, sendEventEmailsNow } from "@/lib/actions/events";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);

export interface EmailCounts {
  // Emails still to go out: one per address (a couple sharing one gets one),
  // for guests who aren't opted out, when that email is switched on.
  thankYou: number;
  missed: number;
  // Already gone out.
  sentThankYou: number;
  sentMissed: number;
  // Can't be emailed: no address, or marked "don't email".
  cantEmail: number;
}

// The step after the event: "Attendance is finished" locks in who came and
// queues the thank-you / missed-you emails for the next morning.
export function EventAttendancePanel({
  eventId,
  hasHappened,
  guestCount,
  unmarked,
  finishedOn,
  sendLabel,
  emails,
  googleConnected,
}: {
  eventId: string;
  hasHappened: boolean;
  guestCount: number;
  unmarked: number;
  finishedOn: string | null; // when attendance was finished; null while open
  sendLabel: string; // "tomorrow at 9 AM"
  emails: EmailCounts;
  googleConnected: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const toSend = emails.thankYou + emails.missed;
  const sent = emails.sentThankYou + emails.sentMissed;
  const queue = `${plural(emails.thankYou, "thank-you email")} and ${plural(emails.missed, "missed-you email")}`;

  const googleWarning = !googleConnected && toSend > 0 && (
    <p className="text-sm text-amber-700 dark:text-amber-300">
      Google isn&apos;t connected, so these emails can&apos;t send yet. Connect it on the{" "}
      <Link href="/settings/google" className="link">
        Google
      </Link>{" "}
      settings page.
    </p>
  );

  if (!finishedOn) {
    return (
      <div className="surface flex flex-col gap-3 p-4">
        <p className="text-sm">
          {hasHappened ? (
            <>
              Mark who came, then click <strong>Attendance is finished</strong>. Anyone not marked counts as a
              no-show. The thank-you and missed-you emails go out {sendLabel}, so there&apos;s time to fix a mistake.
            </>
          ) : (
            <>
              This event hasn&apos;t happened yet. Add your RSVPs below and print the sign-in sheet; come back
              afterward to mark who came.
            </>
          )}
        </p>
        {hasHappened && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || guestCount === 0}
              className="btn-primary"
              onClick={() => {
                const lines = [
                  unmarked ? `${people(unmarked)} not marked yet will count as ${unmarked === 1 ? "a no-show" : "no-shows"}.` : null,
                  toSend ? `${queue} will go out ${sendLabel}.` : "No emails will go out (no one has an email address).",
                ].filter(Boolean);
                if (!confirm(`Finish attendance?\n\n${lines.join("\n")}`)) return;
                startTransition(() => finishAttendance(eventId));
              }}
            >
              {pending ? "Saving…" : "Attendance is finished"}
            </button>
            {guestCount > 0 && (
              <span className="muted text-xs">
                {unmarked ? `${unmarked} not marked yet` : "Everyone is marked"}
              </span>
            )}
          </div>
        )}
        {hasHappened && googleWarning}
      </div>
    );
  }

  return (
    <div className="surface flex flex-col gap-3 p-4">
      <p className="text-sm">
        Attendance was finished {finishedOn}.{" "}
        {toSend > 0 ? (
          <>
            <strong>{queue}</strong> will go out {sendLabel}.
          </>
        ) : sent > 0 ? (
          <>The follow-up emails have gone out.</>
        ) : (
          <>No follow-up emails to send.</>
        )}
      </p>
      <p className="muted text-xs">
        {sent > 0 && `Sent so far: ${emails.sentThankYou} thank-you, ${emails.sentMissed} missed-you. `}
        {emails.cantEmail > 0 && `${people(emails.cantEmail)} can't be emailed (no address, or marked don't email).`}
      </p>
      {googleWarning}
      <div className="flex flex-wrap items-center gap-3">
        {toSend > 0 && (
          <button
            type="button"
            disabled={pending}
            className="btn-primary"
            onClick={() => {
              if (!confirm(`Send ${queue} right now?`)) return;
              setMessage(null);
              startTransition(async () => {
                const r = await sendEventEmailsNow(eventId);
                // The first problem is enough: it's nearly always the same for all.
                const first = r.errors[0];
                const problem = first
                  ? ` Couldn't send ${first.contactName === "(all)" ? "them" : plural(r.errors.length, "email")}: ${first.error.slice(0, 160)}`
                  : "";
                setMessage(`Sent ${plural(r.sent, "email")}.${problem}`);
              });
            }}
          >
            {pending ? "Working…" : "Send now"}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className="btn-secondary"
          onClick={() => startTransition(() => reopenAttendance(eventId))}
        >
          {toSend > 0 ? "Reopen attendance (hold the emails)" : "Reopen attendance"}
        </button>
        {message && <span className="muted text-xs">{message}</span>}
      </div>
    </div>
  );
}

export function DeleteEventButton({ eventId, name, guestCount }: { eventId: string; name: string; guestCount: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-danger-text text-sm"
      onClick={() => {
        const who = guestCount ? ` and the ${plural(guestCount, "guest")} on its list` : "";
        if (!confirm(`Delete ${name}${who}? Anyone already added to Contacts stays there. This can't be undone.`)) return;
        startTransition(() => deleteEvent(eventId));
      }}
    >
      {pending ? "Deleting…" : "Delete event"}
    </button>
  );
}
