"use client";

import { useMemo, useState, useTransition } from "react";
import { addGuestsFromPaste } from "@/lib/actions/events";
import { guestKey, parseGuestList } from "@/lib/guestPaste";

// Paste the RSVP list (from an email or a spreadsheet); shows who it found
// before anything is added.
export function EventPasteGuests({ eventId, existingKeys }: { eventId: string; existingKeys: string[] }) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const seen = new Set(existingKeys);
    return parseGuestList(text).map((g) => {
      const key = guestKey(g);
      const duplicate = seen.has(key);
      seen.add(key);
      return { ...g, duplicate };
    });
  }, [text, existingKeys]);
  const fresh = preview.filter((g) => !g.duplicate).length;

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMessage(null);
        }}
        rows={5}
        placeholder={"Paste the RSVPs here, one person per line. Email and phone are picked up if they're there.\n\nJordan Example\tjordan@example.com\t949-555-0100\nSam and Riley Sample"}
        className="field w-full font-mono text-xs"
      />

      {preview.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-1.5 font-medium">First name</th>
                <th className="px-3 py-1.5 font-medium">Last name</th>
                <th className="px-3 py-1.5 font-medium">Email</th>
                <th className="px-3 py-1.5 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((g, i) => (
                <tr key={i} className={`border-t border-slate-200 dark:border-slate-800 ${g.duplicate ? "opacity-50" : ""}`}>
                  <td className="px-3 py-1.5">{g.firstName}</td>
                  <td className="px-3 py-1.5">{g.lastName}</td>
                  <td className="px-3 py-1.5">{g.email ?? ""}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {g.phone ?? ""}
                    {g.duplicate && <span className="muted ml-2 text-xs">already on the list</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || fresh === 0}
          className="btn-primary"
          onClick={() =>
            startTransition(async () => {
              const res = await addGuestsFromPaste(eventId, text);
              if ("error" in res) {
                setMessage({ text: res.error, error: true });
                return;
              }
              setText("");
              setMessage({
                text: `Added ${res.added}${res.skipped ? `, skipped ${res.skipped} already on the list` : ""}.`,
              });
            })
          }
        >
          {pending ? "Adding…" : fresh ? `Add ${fresh} ${fresh === 1 ? "person" : "people"}` : "Add to the list"}
        </button>
        {message && (
          <span className={`text-sm ${message.error ? "text-red-600 dark:text-red-400" : "font-medium text-emerald-600 dark:text-emerald-400"}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
