"use client";

import { useActionState, useEffect, useRef, useState } from "react";

type Result = { ok: true; at: number } | { ok: false; error: string } | null;

// Wraps a server action so its submit button shows "Saving…" and then a
// "Saved" confirmation (or the error), instead of silently re-rendering.
export function SaveForm({
  action,
  children,
  submitLabel = "Save",
  savedLabel = "Saved ✓",
  resetOnSuccess = false,
  primary = false,
  className,
}: {
  action: (formData: FormData) => Promise<unknown>;
  children: React.ReactNode;
  submitLabel?: string;
  savedLabel?: string;
  resetOnSuccess?: boolean;
  primary?: boolean;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, formAction, pending] = useActionState<Result, FormData>(async (_prev, formData) => {
    try {
      // Actions report validation problems by returning { error } — thrown
      // messages are replaced with a generic one in production builds.
      const res = await action(formData);
      if (res && typeof res === "object" && "error" in res && typeof res.error === "string") {
        return { ok: false, error: res.error };
      }
      return { ok: true, at: Date.now() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't save." };
    }
  }, null);

  // The confirmation shows until its timer marks that particular save as seen.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const showSaved = result?.ok === true && result.at !== dismissedAt;
  useEffect(() => {
    if (result?.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      const at = result.at;
      const t = setTimeout(() => setDismissedAt(at), 3000);
      return () => clearTimeout(t);
    }
  }, [result, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      <div className="col-span-full flex items-center gap-3">
        <button type="submit" disabled={pending} className={primary ? "btn-primary" : "btn-secondary"}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {!pending && showSaved && (
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{savedLabel}</span>
        )}
        {!pending && result && !result.ok && (
          <span className="text-sm text-red-600 dark:text-red-400">{result.error}</span>
        )}
      </div>
    </form>
  );
}
