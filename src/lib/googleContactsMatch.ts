import type { GooglePerson } from "@/lib/googlePeople";

// Matching CRM contacts to the cards already in Google Contacts. Sure matches
// are linked; anything doubtful (same phone but a different name, a name with
// nothing else to go on) is left for a person to decide.

// The key on the cards the CRM made, holding the CRM contact's id.
export const CRM_ID_KEY = "medicareCrmId";

// The review reason "Link all name matches" acts on.
export const NAME_ONLY = "Same name only";

export interface MatchableContact {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  cellPhone: string | null;
  email: string | null;
  dateOfBirth: Date | null;
  spouseFirstName?: string | null;
}

export interface GoogleCandidate {
  resourceName: string;
  name: string;
  phones: string[];
  emails: string[];
  why: string;
}

export type MatchResult =
  | { kind: "link"; resourceName: string; why: string }
  | { kind: "review"; reason: string; candidates: GoogleCandidate[] }
  | { kind: "none" };

// Last 10 digits, so "+1 (555) 010-1234" and "555-010-1234" agree.
export function phoneKey(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function emailKey(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toLowerCase();
  return v || null;
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

function nameKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.has(w))
    .join(" ");
}

// "Pat" and "Patricia" agree; "Jane" and "John" don't.
function firstNamesAgree(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));
}

export function personName(p: GooglePerson): { first: string; last: string; display: string } {
  const n = p.names?.[0];
  let first = nameKey(n?.givenName);
  let last = nameKey(n?.familyName);
  if (!first && !last && n?.displayName) {
    const words = nameKey(n.displayName).split(" ");
    first = words[0] ?? "";
    last = words.length > 1 ? words[words.length - 1] : "";
  }
  return {
    first: first.split(" ")[0] ?? "",
    last,
    display: n?.displayName || [n?.givenName, n?.familyName].filter(Boolean).join(" ") || "(no name)",
  };
}

export interface GoogleIndex {
  byPhone: Map<string, GooglePerson[]>;
  byEmail: Map<string, GooglePerson[]>;
  byName: Map<string, GooglePerson[]>;
  byCrmId: Map<string, GooglePerson>;
}

function add(map: Map<string, GooglePerson[]>, key: string | null, p: GooglePerson) {
  if (!key) return;
  const list = map.get(key);
  if (!list) map.set(key, [p]);
  else if (!list.includes(p)) list.push(p);
}

export function indexGooglePeople(people: GooglePerson[]): GoogleIndex {
  const index: GoogleIndex = { byPhone: new Map(), byEmail: new Map(), byName: new Map(), byCrmId: new Map() };
  for (const p of people) {
    for (const ph of p.phoneNumbers ?? []) add(index.byPhone, phoneKey(ph.canonicalForm || ph.value), p);
    for (const em of p.emailAddresses ?? []) add(index.byEmail, emailKey(em.value), p);
    const { first, last } = personName(p);
    if (first && last) add(index.byName, `${first} ${last}`, p);
    const crmId = p.clientData?.find((d) => d.key === CRM_ID_KEY)?.value;
    if (crmId) index.byCrmId.set(crmId, p);
  }
  return index;
}

export function toCandidate(p: GooglePerson, why: string): GoogleCandidate {
  return {
    resourceName: p.resourceName,
    name: personName(p).display,
    phones: (p.phoneNumbers ?? []).map((ph) => ph.value ?? "").filter(Boolean),
    emails: (p.emailAddresses ?? []).map((em) => em.value ?? "").filter(Boolean),
    why,
  };
}

function birthdayMatches(p: GooglePerson, dob: Date): boolean {
  return (p.birthdays ?? []).some(({ date }) => {
    if (!date?.month || !date.day) return false;
    if (date.month !== dob.getUTCMonth() + 1 || date.day !== dob.getUTCDate()) return false;
    return !date.year || date.year === dob.getUTCFullYear();
  });
}

// `taken` holds the Google cards already linked to some CRM contact.
export function matchContact(c: MatchableContact, index: GoogleIndex, taken: Set<string>): MatchResult {
  const free = (p: GooglePerson) => !taken.has(p.resourceName);

  // A card the CRM added before (its link was lost, e.g. restoring a backup).
  const own = index.byCrmId.get(c.id);
  if (own && free(own)) return { kind: "link", resourceName: own.resourceName, why: "added by the CRM before" };

  const first = nameKey(c.firstName).split(" ")[0] ?? "";
  const last = nameKey(c.lastName);
  const spouseFirst = nameKey(c.spouseFirstName).split(" ")[0] ?? "";

  // Same phone or email.
  const hits = new Map<string, { p: GooglePerson; why: string[] }>();
  const hit = (people: GooglePerson[] | undefined, why: string) => {
    for (const p of (people ?? []).filter(free)) {
      const h = hits.get(p.resourceName) ?? { p, why: [] };
      if (!h.why.includes(why)) h.why.push(why);
      hits.set(p.resourceName, h);
    }
  };
  for (const ph of [c.phone, c.cellPhone]) {
    const key = phoneKey(ph);
    if (key) hit(index.byPhone.get(key), "phone");
  }
  const em = emailKey(c.email);
  if (em) hit(index.byEmail.get(em), "email");

  // A husband or wife sharing the number is their own card, not this one.
  const shared = [...hits.values()].filter(({ p }) => {
    const n = personName(p).first;
    return !(spouseFirst && firstNamesAgree(n, spouseFirst) && !firstNamesAgree(n, first));
  });
  if (shared.length) {
    const why = (h: { why: string[] }) => `same ${h.why.join(" and ")}`;
    const agree = shared.filter(({ p }) => firstNamesAgree(personName(p).first, first));
    if (agree.length === 1) return { kind: "link", resourceName: agree[0].p.resourceName, why: why(agree[0]) };
    if (agree.length > 1) {
      return {
        kind: "review",
        reason: `${agree.length} Google contacts match`,
        candidates: agree.map((h) => toCandidate(h.p, why(h))),
      };
    }
    return {
      kind: "review",
      reason: "Same phone or email, different name",
      candidates: shared.map((h) => toCandidate(h.p, why(h))),
    };
  }

  // Same name.
  const named = (index.byName.get(`${first} ${last}`) ?? []).filter(free);
  if (named.length) {
    if (c.dateOfBirth) {
      const dob = c.dateOfBirth;
      const born = named.filter((p) => birthdayMatches(p, dob));
      if (born.length === 1) return { kind: "link", resourceName: born[0].resourceName, why: "same name and birthday" };
    }
    return {
      kind: "review",
      reason: named.length === 1 ? NAME_ONLY : `${named.length} Google contacts with this name`,
      candidates: named.map((p) => toCandidate(p, "same name")),
    };
  }

  return { kind: "none" };
}
