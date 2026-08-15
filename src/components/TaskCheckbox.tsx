"use client";

import { useTransition } from "react";
import { toggleTaskDone } from "@/lib/actions/tasks";

export function TaskCheckbox({ taskId, done }: { taskId: string; done: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      defaultChecked={done}
      disabled={isPending}
      onChange={(e) => {
        const checked = e.target.checked;
        startTransition(() => {
          toggleTaskDone(taskId, checked);
        });
      }}
      className="h-4 w-4 accent-indigo-600"
    />
  );
}
