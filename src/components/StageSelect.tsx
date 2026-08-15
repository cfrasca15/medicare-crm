"use client";

import { useTransition } from "react";
import { updateContactStage } from "@/lib/actions/contacts";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import type { PipelineStage } from "@/generated/prisma/client";

export function StageSelect({
  contactId,
  stage,
}: {
  contactId: string;
  stage: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={stage}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value as PipelineStage;
        startTransition(() => {
          updateContactStage(contactId, value);
        });
      }}
      className="field"
    >
      {STAGE_ORDER.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
