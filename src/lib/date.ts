// Dates like effectiveDate/dueDate/dateOfBirth are calendar dates with no
// meaningful time component, but they're stored as UTC midnight. Using
// local-timezone methods (toLocaleDateString, getFullYear) on them shifts
// the displayed date back a day for any timezone west of UTC. These
// helpers read the UTC components directly instead.

export function formatDateOnly(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

export function dateOnlyYear(date: Date): number {
  return date.getUTCFullYear();
}
