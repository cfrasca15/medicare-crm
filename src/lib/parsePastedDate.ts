// Turns a pasted date ("03/15/1950", "3-15-50", "March 15, 1950",
// "1950-03-15", "DOB: 03151950") into the YYYY-MM-DD a date box takes.
// US order (month first) for slashed dates. Null if it isn't a real date.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parsePastedDate(text: string, today = new Date()): string | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return null;
  let m: RegExpMatchArray | null;

  // 1950-03-15, 1950/3/15 (also with a time after it)
  if ((m = t.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/))) return build(+m[1], +m[2], +m[3]);

  // 03/15/1950, 3-15-50, 3.15.1950
  if ((m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/))) {
    return build(year(m[3], today), +m[1], +m[2]);
  }

  // March 15, 1950 / Mar 15 1950 / Mar. 15th, 1950
  if ((m = t.match(/\b([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4}|\d{2})\b/))) {
    const mo = month(m[1]);
    if (mo) return build(year(m[3], today), mo, +m[2]);
  }

  // 15 March 1950
  if ((m = t.match(/\b(\d{1,2}) ([A-Za-z]{3,9})\.?,? (\d{4})\b/))) {
    const mo = month(m[2]);
    if (mo) return build(+m[3], mo, +m[1]);
  }

  // 03151950 (MMDDYYYY), the whole paste only
  if ((m = t.match(/^(?:[A-Za-z ]+:? ?)?(\d{2})(\d{2})(\d{4})$/))) return build(+m[3], +m[1], +m[2]);

  return null;
}

function month(name: string): number | null {
  const i = MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  return i >= 0 ? i + 1 : null;
}

// Two-digit years: this century unless that's over a year away, so a
// birth year of "50" is 1950 and an effective date of "27" is 2027.
function year(y: string, today: Date): number {
  if (y.length === 4) return +y;
  const n = 2000 + +y;
  return n > today.getFullYear() + 1 ? n - 100 : n;
}

function build(y: number, mo: number, d: number): string | null {
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1) return null; // e.g. Feb 30
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
