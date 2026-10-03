"use client";

import { useTransition } from "react";

export function DeleteContactButton({
  name,
  action,
}: {
  name: string;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-danger-text text-sm"
      onClick={() => {
        if (!confirm(`Delete ${name}? This also removes their policies and notes.`)) return;
        startTransition(() => action());
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
