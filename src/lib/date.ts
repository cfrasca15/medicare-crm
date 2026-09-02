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

// yyyy-mm-dd, for populating an <input type="date"> defaultValue.
export function dateInputValue(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

// Accepts either M/D/YYYY (formatDateOnly's output) or yyyy-mm-dd
// (dateInputValue's/date input's output) — the two shapes a broker is
// likely to have in a spreadsheet cell.
export function parseDateCell(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  return undefined;
}
