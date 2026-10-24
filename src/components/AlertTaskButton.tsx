"use client";

import { useState, useTransition } from "react";
import { bulkAddTask } from "@/lib/actions/bulk";

// "Add a task for each": one follow-up task per affected client.
export function AlertTaskButton({ contactIds, title }: { contactIds: string[]; title: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [due, setDue] = useState("");

  if (done) return <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{done}</span>;

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="field py-1" aria-label="Due date" />
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await bulkAddTask(contactIds, title, due);
            setDone(res.error ?? `Added a task for ${res.count} client${res.count === 1 ? "" : "s"} ✓`);
          })
        }
        className="btn-secondary"
      >
        {isPending ? "Adding…" : `Add a task for each (${contactIds.length})`}
      </button>
    </span>
  );
}
