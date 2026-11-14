"use client";

import { Fragment, useOptimistic, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { deleteGuest, setAttendance, unlinkGuestContact, updateGuest } from "@/lib/actions/events";
import { CallButton } from "@/components/CallButton";
import { EventFollowUpButtons } from "@/components/EventFollowUpButtons";

export interface GuestRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  walkIn: boolean;
  attended: boolean | null;
  noEmail: boolean;
  notInterested: boolean;
  contact: { id: string; name: string } | null;
  // e.g. "Thank-you sent 11/8/2026"; null when nothing has gone out.
  emailSent: string | null;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// The guest list for one event: mark who came, fix details, and decide what
// happens to each person afterward.
export function EventGuestTable({ guests }: { guests: GuestRow[] }) {
  const [rows, markOptimistic] = useOptimistic(
    guests,
    (state, change: { id: string; attended: boolean | null }) =>
      state.map((g) => (g.id === change.id ? { ...g, attended: change.attended } : g))
  );
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mark = (g: GuestRow, attended: boolean) => {
    // Clicking the lit-up choice again clears it.
    const next = g.attended === attended ? null : attended;
    startTransition(async () => {
      markOptimistic({ id: g.id, attended: next });
      await setAttendance(g.id, next);
    });
  };

  const choice = (active: boolean, on: string) =>
    `cursor-pointer px-2.5 py-1 text-xs font-medium transition-colors ${
      active ? on : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="table-head">
          <tr>
            <th className="px-3 py-2 font-medium">Attended?</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Afterward</th>
            <th className="px-3 py-2 font-medium">Follow-up email</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <Fragment key={g.id}>
              <tr className="table-row-hover border-t border-slate-200 align-top dark:border-slate-800">
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
                    <button
                      type="button"
                      aria-pressed={g.attended === true}
                      onClick={() => mark(g, true)}
                      className={choice(g.attended === true, "bg-emerald-600 text-white")}
                    >
                      Came
                    </button>
                    <button
                      type="button"
                      aria-pressed={g.attended === false}
                      onClick={() => mark(g, false)}
                      className={`border-l border-slate-300 dark:border-slate-700 ${choice(g.attended === false, "bg-slate-600 text-white")}`}
                    >
                      No-show
                    </button>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium">
                    {g.firstName} {g.lastName}
                  </span>
                  {g.walkIn && (
                    <span className="pill ml-2 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Walk-in</span>
                  )}
                  {g.notes && <div className="muted mt-0.5 max-w-xs text-xs whitespace-pre-wrap">{g.notes}</div>}
                </td>
                <td className="px-3 py-2">{g.email ?? <span className="muted">—</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {g.phone ? (
                    <span className="flex items-center gap-2">
                      {g.phone} <CallButton phone={g.phone} />
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <EventFollowUpButtons guestId={g.id} contact={g.contact} notInterested={g.notInterested} />
                </td>
                <td className="muted px-3 py-2 text-xs whitespace-nowrap">
                  {g.emailSent ?? (g.noEmail ? "Don't email" : !g.email ? "No email address" : "Not sent yet")}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="link text-xs font-medium"
                    onClick={() => {
                      setError(null);
                      setEditing(editing === g.id ? null : g.id);
                    }}
                  >
                    {editing === g.id ? "Close" : "Edit"}
                  </button>
                </td>
              </tr>
              {editing === g.id && (
                <tr className="border-t border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/30">
                  <td colSpan={7} className="px-3 py-3">
                    <form
                      action={async (formData) => {
                        const res = await updateGuest(g.id, formData);
                        if (res?.error) setError(res.error);
                        else setEditing(null);
                      }}
                      className="grid grid-cols-2 gap-2 md:grid-cols-4"
                    >
                      <input name="firstName" defaultValue={g.firstName} placeholder="First name" required className="field" />
                      <input name="lastName" defaultValue={g.lastName} placeholder="Last name" className="field" />
                      <input name="email" type="email" defaultValue={g.email ?? ""} placeholder="Email" className="field" />
                      <input name="phone" defaultValue={g.phone ?? ""} placeholder="Phone" className="field" />
                      <textarea
                        name="notes"
                        defaultValue={g.notes ?? ""}
                        placeholder="Notes (what you talked about, when to call…)"
                        rows={2}
                        className="field col-span-2 md:col-span-4"
                      />
                      <label className="col-span-2 flex items-center gap-2 text-sm md:col-span-4">
                        <input type="checkbox" name="noEmail" defaultChecked={g.noEmail} />
                        Don&apos;t send this person the follow-up email
                      </label>
                      <div className="col-span-2 flex flex-wrap items-center gap-4 md:col-span-4">
                        <SaveButton />
                        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
                        {g.contact && (
                          <button
                            type="button"
                            className="muted cursor-pointer text-xs hover:underline"
                            onClick={() => startTransition(() => unlinkGuestContact(g.id))}
                          >
                            Not {g.contact.name}? Unlink from Contacts
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-danger-text ml-auto text-xs"
                          onClick={() => {
                            if (!confirm(`Take ${g.firstName} ${g.lastName} off this event's list?`)) return;
                            setEditing(null);
                            startTransition(() => deleteGuest(g.id));
                          }}
                        >
                          Remove from list
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="muted px-4 py-8 text-center">
                No one on the list yet. Paste your RSVPs or add them one at a time below.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
