import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getGoogleAccount, hasContactsScope } from "@/lib/google";
import {
  batchCreateContacts,
  batchUpdateContacts,
  ensureContactGroup,
  getPerson,
  listAllConnections,
  type GooglePerson,
  type GooglePhone,
} from "@/lib/googlePeople";
import {
  CRM_ID_KEY,
  emailKey,
  indexGooglePeople,
  matchContact,
  personName,
  phoneKey,
  type GoogleCandidate,
} from "@/lib/googleContactsMatch";

// Puts clients in the connected Google account's contacts, so they show up by
// name on your phone. Cards already there are linked rather than duplicated;
// doubtful matches wait on Settings → Google for you to decide. Only name,
// phone and email are sent, plus the "Medicare CRM" label. The CRM only adds
// to a card: it never changes the name, removes anything or deletes a card.
// Server actions wrapping these are in actions/googleContacts.ts.

const CLIENT_STAGES = ["ENROLLED", "RETAINED", "CURRENT_CLIENT"] as const;

export const RECONNECT_MESSAGE =
  "Google needs to be reconnected (Settings → Google → Reconnect) so the CRM can add contacts.";

type Named = { id: string; name: string };

export interface GoogleSyncResult {
  preview: boolean; // nothing was changed in Google
  added: Named[];
  // google/why: the card they matched and the reason (shown by the preview).
  linked: (Named & { google: string; why: string })[];
  updated: (Named & { details: string[] })[];
  review: (Named & { reason: string })[];
  failed: (Named & { error: string })[];
  unchanged: number;
}

export interface PushResult {
  message?: string;
  error?: string;
  review?: { reason: string; candidates: GoogleCandidate[] };
}

const SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  cellPhone: true,
  email: true,
  dateOfBirth: true,
  spouseId: true,
  googleResourceName: true,
} as const;

// Contacts with their spouse's first name, so a husband or wife sharing the
// number isn't taken for them.
async function loadContacts(where: Prisma.ContactWhereInput) {
  const contacts = await prisma.contact.findMany({ where, select: SELECT });
  const spouseIds = contacts.map((c) => c.spouseId).filter((id): id is string => !!id);
  const spouses = spouseIds.length
    ? await prisma.contact.findMany({ where: { id: { in: spouseIds } }, select: { id: true, firstName: true } })
    : [];
  const spouseName = new Map(spouses.map((s) => [s.id, s.firstName]));
  return contacts.map((c) => ({ ...c, spouseFirstName: c.spouseId ? (spouseName.get(c.spouseId) ?? null) : null }));
}
type SyncContact = Awaited<ReturnType<typeof loadContacts>>[number];

const fullName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`;

// The connected account, with the "Medicare CRM" label looked up only when needed.
async function connect() {
  const account = await getGoogleAccount();
  if (!account) throw new Error("Google isn't connected (Settings → Google).");
  if (!hasContactsScope(account)) throw new Error(RECONNECT_MESSAGE);
  let group: Promise<string> | null = null;
  return {
    group: () =>
      (group ??= ensureContactGroup(account.contactsGroup).then(async (g) => {
        if (g !== account.contactsGroup) {
          await prisma.googleAccount.update({ where: { id: account.id }, data: { contactsGroup: g } });
        }
        return g;
      })),
  };
}

function crmPhones(c: SyncContact): GooglePhone[] {
  const phones: GooglePhone[] = [];
  if (c.phone) phones.push({ value: c.phone });
  if (c.cellPhone && phoneKey(c.cellPhone) !== phoneKey(c.phone)) phones.push({ value: c.cellPhone, type: "mobile" });
  return phones;
}

function newPerson(c: SyncContact, group: string): Omit<GooglePerson, "resourceName"> {
  return {
    names: [{ givenName: c.firstName, familyName: c.lastName }],
    phoneNumbers: crmPhones(c),
    emailAddresses: c.email ? [{ value: c.email }] : [],
    memberships: [{ contactGroupMembership: { contactGroupResourceName: group } }],
    clientData: [{ key: CRM_ID_KEY, value: c.id }],
  };
}

interface FillIn {
  body: Partial<GooglePerson>;
  mask: string[];
  details: string[];
}

// What to add to a Google card: a phone or email it doesn't have yet, and,
// when linking (`group` given), the label and the CRM's id. Updated fields are
// sent whole, so the card's existing entries go back along with the new ones.
function fillIn(person: GooglePerson, c: SyncContact, group: string | null): FillIn {
  const body: Partial<GooglePerson> = { etag: person.etag, metadata: person.metadata };
  const mask: string[] = [];
  const details: string[] = [];

  const havePhones = new Set((person.phoneNumbers ?? []).map((p) => phoneKey(p.canonicalForm || p.value)));
  const newPhones = crmPhones(c).filter((p) => {
    const key = phoneKey(p.value);
    return key && !havePhones.has(key);
  });
  if (newPhones.length) {
    body.phoneNumbers = [...(person.phoneNumbers ?? []), ...newPhones];
    mask.push("phoneNumbers");
    details.push("phone");
  }

  const email = emailKey(c.email);
  if (email && !(person.emailAddresses ?? []).some((e) => emailKey(e.value) === email)) {
    body.emailAddresses = [...(person.emailAddresses ?? []), { value: c.email! }];
    mask.push("emailAddresses");
    details.push("email");
  }

  if (group) {
    const memberships = (person.memberships ?? []).filter((m) => m.contactGroupMembership?.contactGroupResourceName);
    if (!memberships.some((m) => m.contactGroupMembership?.contactGroupResourceName === group)) {
      body.memberships = [...memberships, { contactGroupMembership: { contactGroupResourceName: group } }];
      mask.push("memberships");
    }
    if (!(person.clientData ?? []).some((d) => d.key === CRM_ID_KEY)) {
      body.clientData = [...(person.clientData ?? []), { key: CRM_ID_KEY, value: c.id }];
      mask.push("clientData");
    }
  }
  return { body, mask, details };
}

async function saveReview(contactId: string, reason: string, candidates: GoogleCandidate[]) {
  const data = { reason, candidatesJson: JSON.stringify(candidates) };
  await prisma.googleContactReview.upsert({ where: { contactId }, create: { contactId, ...data }, update: data });
}

async function setLink(contactId: string, resourceName: string) {
  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { googleResourceName: resourceName, googleSyncSkip: false } }),
    prisma.googleContactReview.deleteMany({ where: { contactId } }),
  ]);
}

let inFlight: Promise<GoogleSyncResult> | null = null;

// Every client (and anyone linked by hand), in one pass: list Google's
// contacts, match, then write. A run already going is shared, not repeated.
export function runGoogleContactsSync(): Promise<GoogleSyncResult> {
  inFlight ??= syncAll(false).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// What a sync would do, without changing anything in Google or any links.
// Doubtful matches are still listed on Settings → Google for review.
export function previewGoogleContactsSync(): Promise<GoogleSyncResult> {
  return syncAll(true);
}

// The scheduled run and saves only sync once it's turned on in Settings → Google.
export async function autoSyncOn(): Promise<boolean> {
  const account = await getGoogleAccount();
  return hasContactsScope(account) && !!account?.contactsAutoSync;
}

async function syncAll(preview: boolean): Promise<GoogleSyncResult> {
  const google = await connect();
  const result: GoogleSyncResult = { preview, added: [], linked: [], updated: [], review: [], failed: [], unchanged: 0 };

  const people = await listAllConnections();
  const byResource = new Map(people.map((p) => [p.resourceName, p]));
  const index = indexGooglePeople(people);
  const contacts = await loadContacts({
    googleSyncSkip: false,
    OR: [{ stage: { in: [...CLIENT_STAGES] } }, { googleResourceName: { not: null } }],
  });
  const linkedRows = await prisma.contact.findMany({
    where: { googleResourceName: { not: null } },
    select: { googleResourceName: true },
  });
  const taken = new Set(linkedRows.map((r) => r.googleResourceName!));

  const updates: { c: SyncContact; resourceName: string; fill: FillIn; linking: boolean; why: string }[] = [];
  const creates: SyncContact[] = [];
  const reviews = new Map<string, { c: SyncContact; reason: string; candidates: GoogleCandidate[] }>();

  for (const c of contacts) {
    if (c.googleResourceName) {
      const person = byResource.get(c.googleResourceName);
      if (person) {
        const fill = fillIn(person, c, null);
        if (fill.mask.length) updates.push({ c, resourceName: person.resourceName, fill, linking: false, why: "" });
        else result.unchanged++;
        continue;
      }
      // Deleted in Google (or merged into another card there): match again.
      taken.delete(c.googleResourceName);
      if (!preview) await prisma.contact.update({ where: { id: c.id }, data: { googleResourceName: null } });
    }
    const m = matchContact(c, index, taken);
    if (m.kind === "link") {
      taken.add(m.resourceName);
      // The preview leaves the label alone (looking it up could create it).
      const fill = fillIn(byResource.get(m.resourceName)!, c, preview ? null : await google.group());
      updates.push({ c, resourceName: m.resourceName, fill, linking: true, why: m.why });
    } else if (m.kind === "review") {
      reviews.set(c.id, { c, reason: m.reason, candidates: m.candidates });
    } else {
      creates.push(c);
    }
  }

  if (preview) {
    for (const u of updates) {
      const named = { id: u.c.id, name: fullName(u.c) };
      if (u.linking) {
        const added = u.fill.details.length ? `; would add ${u.fill.details.join(" and ")}` : "";
        result.linked.push({ ...named, google: personName(byResource.get(u.resourceName)!).display, why: u.why + added });
      } else result.updated.push({ ...named, details: u.fill.details });
    }
    result.added = creates.map((c) => ({ id: c.id, name: fullName(c) }));
  }

  // Updates, in batches that share the same fields.
  const byMask = new Map<string, typeof updates>();
  for (const u of updates) {
    const key = u.fill.mask.join(",");
    byMask.set(key, [...(byMask.get(key) ?? []), u]);
  }
  for (const [mask, group] of preview ? [] : byMask) {
    const failed = mask
      ? await batchUpdateContacts(new Map(group.map((u) => [u.resourceName, u.fill.body])), mask)
      : new Map<string, string>();
    for (const u of group) {
      const named = { id: u.c.id, name: fullName(u.c) };
      const error = failed.get(u.resourceName);
      if (error) {
        result.failed.push({ ...named, error });
      } else if (u.linking) {
        const google = personName(byResource.get(u.resourceName)!).display;
        await setLink(u.c.id, u.resourceName)
          .then(() => result.linked.push({ ...named, google, why: u.why }))
          .catch((err) => result.failed.push({ ...named, error: String(err?.message ?? err) }));
      } else {
        result.updated.push({ ...named, details: u.fill.details });
      }
    }
  }

  if (creates.length && !preview) {
    const group = await google.group();
    const created = await batchCreateContacts(creates.map((c) => newPerson(c, group)));
    for (const [i, r] of created.entries()) {
      const c = creates[i];
      const named = { id: c.id, name: fullName(c) };
      if ("error" in r) result.failed.push({ ...named, error: r.error });
      else {
        await setLink(c.id, r.resourceName)
          .then(() => result.added.push(named))
          .catch((err) => result.failed.push({ ...named, error: String(err?.message ?? err) }));
      }
    }
  }

  for (const { c, reason, candidates } of reviews.values()) {
    await saveReview(c.id, reason, candidates);
    result.review.push({ id: c.id, name: fullName(c), reason });
  }
  // Reviews for anyone settled since (linked, no longer a client, skipped).
  await prisma.googleContactReview.deleteMany({ where: { contactId: { notIn: [...reviews.keys()] } } });
  if (!preview) await prisma.googleAccount.updateMany({ data: { lastContactsSyncAt: new Date() } });

  return result;
}

// One contact: update their linked card, or find their card and link it, or
// add them. A doubtful match comes back as `review` for the person to decide;
// createAnyway skips matching ("Add as new").
export async function pushContactToGoogle(contactId: string, createAnyway = false): Promise<PushResult> {
  const google = await connect();
  const [c] = await loadContacts({ id: contactId });
  if (!c) return { error: "Contact not found." };

  if (c.googleResourceName) {
    const person = await getPerson(c.googleResourceName);
    if (person) {
      const fill = fillIn(person, c, null);
      if (!fill.mask.length) return { message: "Already up to date in Google ✓" };
      const failed = await batchUpdateContacts(new Map([[person.resourceName, fill.body]]), fill.mask.join(","));
      const error = failed.get(person.resourceName);
      return error ? { error: `Google didn't take the update: ${error}` } : { message: `Updated ${fill.details.join(" and ")} in Google ✓` };
    }
    await prisma.contact.update({ where: { id: c.id }, data: { googleResourceName: null } });
  }

  if (!createAnyway) {
    const people = await listAllConnections();
    const linkedRows = await prisma.contact.findMany({
      where: { googleResourceName: { not: null } },
      select: { googleResourceName: true },
    });
    const m = matchContact(c, indexGooglePeople(people), new Set(linkedRows.map((r) => r.googleResourceName!)));
    if (m.kind === "link") return linkTo(c, people.find((p) => p.resourceName === m.resourceName)!, await google.group());
    if (m.kind === "review") {
      await saveReview(c.id, m.reason, m.candidates);
      return { review: { reason: m.reason, candidates: m.candidates } };
    }
  }

  const [r] = await batchCreateContacts([newPerson(c, await google.group())]);
  if ("error" in r) return { error: `Google didn't add them: ${r.error}` };
  await setLink(c.id, r.resourceName);
  return { message: "Added to Google Contacts ✓" };
}

async function linkTo(c: SyncContact, person: GooglePerson, group: string): Promise<PushResult> {
  const fill = fillIn(person, c, group);
  if (fill.mask.length) {
    const failed = await batchUpdateContacts(new Map([[person.resourceName, fill.body]]), fill.mask.join(","));
    const error = failed.get(person.resourceName);
    if (error) return { error: `Google didn't take the update: ${error}` };
  }
  await setLink(c.id, person.resourceName);
  const added = fill.details.length ? `; added ${fill.details.join(" and ")}` : "";
  return { message: `Linked to ${personName(person).display} in Google${added} ✓` };
}

// Links a contact to the Google card picked on the review list.
export async function linkContactToGoogleCard(contactId: string, resourceName: string): Promise<PushResult> {
  const google = await connect();
  const other = await prisma.contact.findFirst({
    where: { googleResourceName: resourceName, id: { not: contactId } },
    select: { firstName: true, lastName: true },
  });
  if (other) return { error: `That Google contact is already linked to ${fullName(other)}.` };
  const [c] = await loadContacts({ id: contactId });
  if (!c) return { error: "Contact not found." };
  const person = await getPerson(resourceName);
  if (!person) return { error: "That Google contact no longer exists." };
  return linkTo(c, person, await google.group());
}

// After a contact is saved: keeps a client's (or linked contact's) Google
// card in step. Quiet: problems go to the server log, never to the form.
export async function pushContactToGoogleQuietly(contactId: string): Promise<void> {
  try {
    if (!(await autoSyncOn())) return;
    const c = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { stage: true, googleResourceName: true, googleSyncSkip: true },
    });
    if (!c || c.googleSyncSkip) return;
    if (!c.googleResourceName && !(CLIENT_STAGES as readonly string[]).includes(c.stage)) return;
    const r = await pushContactToGoogle(contactId);
    if (r.error) console.error(`Google Contacts update failed: ${r.error}`);
  } catch (err) {
    console.error("Google Contacts update failed:", err);
  }
}
