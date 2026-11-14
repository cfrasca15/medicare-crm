// Turns a pasted RSVP list into guests. Works on rows copied from a
// spreadsheet (tab-separated: name, email, phone) and on plain lines from an
// email ("Pat Lee, pat@example.com, 949-555-0100" or "Pat Lee <pat@example.com>").
// No database access, so the paste box can preview with it in the browser.

export interface ParsedGuest {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

const EMAIL = /[^\s<>(),;:"']+@[^\s<>(),;:"']+\.[a-z]{2,}/i;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/;
const HEADER_WORDS = new Set([
  "#", "name", "names", "full name", "first", "last", "first name", "last name",
  "email", "e-mail", "email address", "phone", "phone number", "cell", "attended", "attended?",
]);
// What an "Attended?" cell or a row-number cell holds: not part of a name.
const FILLER = /^(\d+[.)]?|true|false|yes|no|y|n|x|✓|✔|☐|☑)$/i;
const TITLE = /^(mr|mrs|ms|miss|dr)\.?\s+/i;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

// "PAT LEE" and "pat lee" become "Pat Lee"; mixed case is left as typed.
function fixCase(s: string): string {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

function splitName(full: string): { firstName: string; lastName: string } {
  const words = tidy(full.replace(TITLE, "")).split(" ").filter(Boolean);
  return { firstName: fixCase(words[0] ?? ""), lastName: fixCase(words.slice(1).join(" ")) };
}

// "Pat and Sam Lee" is two guests who share the last name; "Pat Lee & Sam Roe"
// is two guests with their own.
function splitPeople(name: string): { firstName: string; lastName: string }[] {
  const pair = name.match(/^(.+?)\s+(?:and|&|\+)\s+(.+)$/i);
  if (!pair) return [splitName(name)];
  const a = splitName(pair[1]);
  const b = splitName(pair[2]);
  if (!a.lastName) a.lastName = b.lastName;
  return [a, b].filter((p) => p.firstName);
}

export function parseGuestList(text: string): ParsedGuest[] {
  const guests: ParsedGuest[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;

    const email = line.match(EMAIL)?.[0] ?? null;
    if (email) line = line.replace(email, " ");
    const phone = line.match(PHONE)?.[0].trim() ?? null;
    if (phone) line = line.replace(phone, " ");

    let name: string;
    if (rawLine.includes("\t")) {
      const cells = line
        .split("\t")
        .map((c) => tidy(c.replace(/[<>()"]/g, " ")))
        .filter((c) => c && !FILLER.test(c));
      if (cells.length && cells.every((c) => HEADER_WORDS.has(c.toLowerCase()))) continue;
      // Up to two name cells: "First Last" in one, or first and last in two.
      name = cells.slice(0, 2).join(" ");
    } else {
      name = tidy(
        line
          .replace(/[<>()"]/g, " ")
          .replace(/^\s*\d+[.)]\s+/, "")
          .replace(/[\s,;:|\-–—]+$/, "")
          .replace(/^[\s,;:|\-–—]+/, "")
      );
      if (HEADER_WORDS.has(name.toLowerCase())) continue;
      // "Lee, Pat" is last name first.
      const lastFirst = name.match(/^([^,]+),\s*([^,]+)$/);
      if (lastFirst) name = `${lastFirst[2]} ${lastFirst[1]}`;
      name = tidy(name.replace(/[,;:|]/g, " "));
    }

    // An address with no name still counts as an RSVP.
    if (!name && email) name = email.split("@")[0].replace(/[._]+/g, " ");
    if (!name) continue;

    for (const person of splitPeople(name)) {
      if (person.firstName) guests.push({ ...person, email, phone });
    }
  }

  return guests;
}

// Same person on a guest list: same first and last name, whatever the case.
export const guestKey = (g: { firstName: string; lastName: string }) =>
  tidy(`${g.firstName} ${g.lastName}`).toLowerCase();
