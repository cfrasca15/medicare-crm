"use client";

import { useState } from "react";

// A contact-page section: its title with a small "+ Add" / "Edit" button on
// the right, and the form only while it's open. `children` (the list or
// summary) shows below; with hideWhenOpen it's swapped for the form instead.
export function ToggleSection({
  title,
  note,
  actionLabel,
  closeLabel = "Cancel",
  form,
  hideWhenOpen = false,
  className,
  children,
}: {
  title: string;
  note?: React.ReactNode; // shown muted after the title, e.g. "none"
  actionLabel: string;
  closeLabel?: string;
  form: React.ReactNode;
  hideWhenOpen?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="section-label">
          {title}
          {note != null && <span className="ml-2 font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">{note}</span>}
        </h2>
        <button type="button" onClick={() => setOpen(!open)} className="link text-sm font-medium" aria-expanded={open}>
          {open ? closeLabel : actionLabel}
        </button>
      </div>
      {open && <div className="mb-3">{form}</div>}
      {!(open && hideWhenOpen) && children}
    </section>
  );
}
