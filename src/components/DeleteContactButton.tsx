"use client";

import { useTransition } from "react";

export function DeleteContactButton({
  name,
  action,
  className = "btn-danger-text text-sm",
}: {
  name: string;
  action: () => Promise<void>;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (!confirm(`Delete ${name}? This also removes their policies and notes.`)) return;
        startTransition(() => action());
      }}
    >
      {pending ? "Deleting…" : "Delete contact"}
    </button>
  );
}
