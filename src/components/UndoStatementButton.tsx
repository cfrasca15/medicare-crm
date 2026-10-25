"use client";

import { useTransition } from "react";
import { undoStatement } from "@/lib/actions/commissions";

export function UndoStatementButton({ id, label }: { id: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Undo ${label}? Its amounts come back off each client's commission received.`)) return;
        startTransition(() => undoStatement(id));
      }}
      className="link text-xs"
    >
      {isPending ? "Undoing…" : "Undo"}
    </button>
  );
}
