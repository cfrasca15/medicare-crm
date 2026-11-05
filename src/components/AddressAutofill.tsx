"use client";

import { useEffect, useRef, useState } from "react";

type Address = { street: string; city: string; state: string; zip: string; county: string };
type Suggestion = { label: string; detail: string; placeId?: string; address?: Address };
type Provider = "google" | "photon" | null;

// A street address box that suggests addresses as you type (via /api/address)
// and, on a pick, fills the city/state/ZIP (and county) boxes of the same
// form. It's still a plain text box: typing by hand works, and so does
// everything if the lookup is down.
export function AddressAutofill({
  id,
  name,
  defaultValue,
  fill,
}: {
  id: string;
  name: string;
  defaultValue?: string | null;
  // Names of the form fields a picked address fills.
  fill: { city: string; state: string; zip: string; county?: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [provider, setProvider] = useState<Provider>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const session = useRef("");
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function lookup(q: string) {
    clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 3) {
      latest.current++;
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const n = ++latest.current;
      if (!session.current) session.current = newSessionToken();
      try {
        const res = await fetch(`/api/address?q=${encodeURIComponent(query)}&session=${session.current}`);
        const data = (await res.json()) as { provider?: Provider; suggestions?: Suggestion[] };
        if (n !== latest.current) return; // a newer keystroke's lookup wins
        setSuggestions(data.suggestions ?? []);
        setProvider(data.provider ?? null);
        setActive(-1);
        setOpen((data.suggestions ?? []).length > 0);
      } catch {
        if (n === latest.current) setOpen(false);
      }
    }, 250);
  }

  async function pick(s: Suggestion) {
    setOpen(false);
    latest.current++;
    let address = s.address;
    if (!address && s.placeId) {
      try {
        const res = await fetch(`/api/address?placeId=${encodeURIComponent(s.placeId)}&session=${session.current}`);
        address = ((await res.json()) as { address?: Address }).address;
      } catch {
        address = undefined;
      }
    }
    session.current = ""; // a pick ends Google's billing session
    if (!address) return;

    const form = inputRef.current?.form;
    // Set directly: an input event here would look the address up again.
    if (inputRef.current) inputRef.current.value = address.street || s.label;
    if (form) {
      setField(form, fill.city, address.city);
      setField(form, fill.state, address.state);
      setField(form, fill.zip, address.zip);
      // Blank when unknown: saving then fills it from the ZIP.
      if (fill.county) setField(form, fill.county, address.county);
    }
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // pick, don't submit the form
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const listId = `${id}-suggestions`;
  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onInput={(e) => lookup(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className="field w-full"
      />
      {open && (
        <div className="surface absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden shadow-lg">
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {suggestions.map((s, i) => (
              <li
                key={`${s.placeId ?? ""}${s.label}${s.detail}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: picking mustn't blur the box first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer flex-col rounded-md px-3 py-1.5 ${
                  i === active ? "bg-indigo-50 dark:bg-indigo-500/15" : ""
                }`}
              >
                <span className="text-sm font-medium">{s.label}</span>
                {s.detail && <span className="muted text-xs">{s.detail}</span>}
              </li>
            ))}
          </ul>
          <p className="muted border-t border-slate-200 px-3 py-1 text-right text-[10px] dark:border-slate-800">
            {provider === "google" ? "Powered by Google" : "© OpenStreetMap contributors"}
          </p>
        </div>
      )}
    </div>
  );
}

function setField(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) setValue(el, value);
}

// Sets a box's value the way typing would, so anything listening sees it.
function setValue(el: HTMLInputElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// A random UUID. crypto.randomUUID only exists on HTTPS pages, and the CRM is
// often reached over plain HTTP.
function newSessionToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
