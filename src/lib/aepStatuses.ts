// AEP worklist statuses, kept apart from src/lib/aep.ts so the status
// dropdown (a client component) doesn't pull in the database code.

export const AEP_STATUSES: { value: string; label: string }[] = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "left_message", label: "Left message" },
  { value: "scheduled", label: "Review scheduled" },
  { value: "staying", label: "Staying" },
  { value: "switching", label: "Switching" },
];
export const AEP_STATUS_LABELS: Record<string, string> = Object.fromEntries(AEP_STATUSES.map((s) => [s.value, s.label]));
export const isReviewed = (status: string) => status === "staying" || status === "switching";
