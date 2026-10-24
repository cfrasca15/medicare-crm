import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/constants";

// Records stage changes on each contact's timeline. `via` says what made the
// change (e.g. "Integrity sync"); leave it out for a change made by hand.
export async function logStageChanges(
  changes: { contactId: string; from: string; to: string }[],
  via?: string
): Promise<void> {
  const real = changes.filter((c) => c.from !== c.to);
  if (!real.length) return;
  await prisma.activity.createMany({
    data: real.map((c) => ({
      contactId: c.contactId,
      type: "stage",
      summary: `Stage: ${STAGE_LABELS[c.from] ?? c.from} → ${STAGE_LABELS[c.to] ?? c.to}${via ? ` (${via})` : ""}`,
    })),
  });
}

export const CALL_OUTCOMES: { value: string; label: string }[] = [
  { value: "talked", label: "Talked" },
  { value: "voicemail", label: "Left voicemail" },
  { value: "no_answer", label: "No answer" },
  { value: "texted", label: "Texted" },
  { value: "wrong_number", label: "Wrong number" },
];

export const CALL_OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  CALL_OUTCOMES.map((o) => [o.value, o.label])
);
