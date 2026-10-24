"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAddTask, bulkSetStage } from "@/lib/actions/bulk";

const BOX = "input[data-bulk-id]";

// Bar above the Contacts list: works on the rows whose checkbox is ticked.
export function BulkBar({ stages }: { stages: { value: string; label: string }[] }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [stage, setStage] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.matches("[data-bulk-all]")) {
        document.querySelectorAll<HTMLInputElement>(BOX).forEach((b) => (b.checked = t.checked));
      }
      if (t.matches(`${BOX}, [data-bulk-all]`)) {
        setCount(document.querySelectorAll(`${BOX}:checked`).length);
      }
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  const ids = () => [...document.querySelectorAll<HTMLInputElement>(`${BOX}:checked`)].map((b) => b.dataset.bulkId!);
  const clear = () => {
    document.querySelectorAll<HTMLInputElement>(`${BOX}, [data-bulk-all]`).forEach((b) => (b.checked = false));
    setCount(0);
  };
  const run = (fn: () => Promise<{ error?: string; count?: number }>, done: (n: number) => string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) setMessage(res.error);
      else {
        setMessage(done(res.count ?? 0));
        clear();
        router.refresh();
      }
    });

  // Only shows once something is ticked.
  if (count === 0 && !message) return null;

  return (
    <div className="surface sticky top-0 z-10 flex flex-wrap items-center gap-3 p-3 text-sm">
      <span className="font-medium">{count} selected</span>
      <select value={stage} onChange={(e) => setStage(e.target.value)} className="field" aria-label="New stage">
        <option value="">Change stage to…</option>
        {stages.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={isPending || !count || !stage}
        onClick={() => run(() => bulkSetStage(ids(), stage), (n) => `Moved ${n} contact(s).`)}
        className="btn-secondary"
      >
        Apply
      </button>
      <span className="muted">or</span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task for each (e.g. AEP review call)"
        className="field min-w-56 flex-1"
        aria-label="Task"
      />
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="field" aria-label="Due date" />
      <button
        type="button"
        disabled={isPending || !count || !title.trim()}
        onClick={() =>
          run(
            () => bulkAddTask(ids(), title, due),
            (n) => {
              setTitle("");
              return `Added the task for ${n} contact(s).`;
            }
          )
        }
        className="btn-secondary"
      >
        Add task
      </button>
      {count > 0 && (
        <button type="button" onClick={clear} className="link text-xs">
          Clear
        </button>
      )}
      {message && <span className="muted text-xs">{message}</span>}
    </div>
  );
}
