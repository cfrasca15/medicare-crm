// Kinds of service requests and who one can be waiting on.

export const SERVICE_CATEGORIES: { value: string; label: string }[] = [
  { value: "id_card", label: "ID card" },
  { value: "billing", label: "Billing / premium" },
  { value: "network", label: "Doctor / network" },
  { value: "rx", label: "Prescription / pharmacy" },
  { value: "claim", label: "Claim / medical bill" },
  { value: "extra_help", label: "Extra Help / Medi-Cal" },
  { value: "enrollment", label: "Enrollment / plan change" },
  { value: "other", label: "Other" },
];

export const SERVICE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.value, c.label])
);

export const WAITING_ON = ["Carrier", "Client", "Doctor's office", "Pharmacy", "Medi-Cal / Social Security", "Other"];

// "open", "waiting:Carrier" or "resolved", as one dropdown.
export const STATUS_CHOICES: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  ...WAITING_ON.map((w) => ({ value: `waiting:${w}`, label: `Waiting on ${w.startsWith("Medi-Cal") ? w : w.toLowerCase()}` })),
  { value: "resolved", label: "Resolved" },
];

export const statusValue = (r: { status: string; waitingOn: string | null }) =>
  r.status === "waiting" && r.waitingOn ? `waiting:${r.waitingOn}` : r.status;

export function statusLabel(r: { status: string; waitingOn: string | null }): string {
  return STATUS_CHOICES.find((c) => c.value === statusValue(r))?.label ?? (r.status === "waiting" ? "Waiting" : "Open");
}

export const STATUS_STYLE: Record<string, string> = {
  open: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  waiting: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
};

// An update as shown next to its request, without repeating the title (the
// timeline keeps the full text).
export function updateText(summary: string, title: string): string {
  if (summary.startsWith("Opened: ")) {
    const note = summary.split("\n").slice(1).join("\n");
    return note ? `Opened: ${note}` : "Opened";
  }
  return summary.startsWith(`${title}: `) ? summary.slice(title.length + 2) : summary;
}
