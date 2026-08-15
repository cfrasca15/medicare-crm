"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateAepReminders, generateOepReminders } from "@/lib/actions/reminders";

export function SeasonalReminderButtons() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const run = (
    label: string,
    action: () => Promise<{ created: number; skipped: number }>
  ) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        setMessage(
          `${label}: ${result.created} created, ${result.skipped} already had one.`
        );
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : `${label} failed.`);
      }
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run("AEP", generateAepReminders)}
        className="btn-secondary"
      >
        Generate AEP Reminders
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => run("OEP", generateOepReminders)}
        className="btn-secondary"
      >
        Generate OEP Reminders
      </button>
      {message && <span className="muted text-xs">{message}</span>}
    </div>
  );
}
