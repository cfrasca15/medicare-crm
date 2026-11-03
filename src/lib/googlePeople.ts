import { getValidAccessToken } from "@/lib/google";

// Google Contacts, through the People API. Needs the contacts permission
// (Settings → Google → Reconnect) and the People API turned on in the CRM's
// Google Cloud project.

const PEOPLE_API_BASE_URL = process.env.GOOGLE_PEOPLE_API_BASE_URL ?? "https://people.googleapis.com/v1";

export const CONTACTS_GROUP_NAME = "Medicare CRM";

// What the CRM reads from each Google contact.
// metadata carries the card's sources, which Google wants sent back on updates.
const PERSON_FIELDS = "metadata,names,phoneNumbers,emailAddresses,birthdays,memberships,clientData";

export interface GooglePhone {
  value?: string;
  type?: string;
  canonicalForm?: string;
}
export interface GoogleEmail {
  value?: string;
  type?: string;
}
export interface GoogleMembership {
  contactGroupMembership?: { contactGroupResourceName?: string };
}
export interface GooglePerson {
  resourceName: string;
  etag?: string;
  metadata?: { deleted?: boolean; sources?: unknown[] };
  names?: { givenName?: string; familyName?: string; displayName?: string }[];
  phoneNumbers?: GooglePhone[];
  emailAddresses?: GoogleEmail[];
  birthdays?: { date?: { year?: number; month?: number; day?: number } }[];
  memberships?: GoogleMembership[];
  clientData?: { key: string; value: string }[];
}

export class GooglePeopleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function peopleFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${PEOPLE_API_BASE_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    // Over Google's per-minute limit: wait and try again.
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return res.json() as Promise<T>;

    const body = await res.text().catch(() => "");
    if (res.status === 403 && /SERVICE_DISABLED|accessNotConfigured/.test(body)) {
      throw new GooglePeopleError(
        "The People API is turned off for the CRM's Google Cloud project. Turn it on (Google Cloud console → APIs & Services → Library → People API), then try again.",
        403
      );
    }
    if (res.status === 403 || res.status === 401) {
      throw new GooglePeopleError(
        "Google needs to be reconnected (Settings → Google → Reconnect) so the CRM can add contacts.",
        res.status
      );
    }
    throw new GooglePeopleError(`Google Contacts request failed: ${res.status} ${body.slice(0, 300)}`, res.status);
  }
}

// Every contact in the account, a page of 1000 at a time.
export async function listAllConnections(): Promise<GooglePerson[]> {
  const people: GooglePerson[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ personFields: PERSON_FIELDS, pageSize: "1000" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await peopleFetch<{ connections?: GooglePerson[]; nextPageToken?: string }>(
      `/people/me/connections?${params}`
    );
    people.push(...(data.connections ?? []).filter((p) => !p.metadata?.deleted));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return people;
}

// One contact, or null if it's been deleted in Google.
export async function getPerson(resourceName: string): Promise<GooglePerson | null> {
  try {
    return await peopleFetch<GooglePerson>(`/${resourceName}?personFields=${PERSON_FIELDS}`);
  } catch (err) {
    if (err instanceof GooglePeopleError && err.status === 404) return null;
    throw err;
  }
}

// The "Medicare CRM" label: the one saved before if it still exists, else one
// with that name, else a new one.
export async function ensureContactGroup(saved: string | null): Promise<string> {
  const data = await peopleFetch<{ contactGroups?: { resourceName: string; name?: string; groupType?: string }[] }>(
    `/contactGroups?pageSize=1000&groupFields=name,groupType`
  );
  const groups = (data.contactGroups ?? []).filter((g) => g.groupType !== "SYSTEM_CONTACT_GROUP");
  const existing =
    groups.find((g) => g.resourceName === saved) ?? groups.find((g) => g.name === CONTACTS_GROUP_NAME);
  if (existing) return existing.resourceName;
  const created = await peopleFetch<{ resourceName: string }>(`/contactGroups`, {
    method: "POST",
    body: JSON.stringify({ contactGroup: { name: CONTACTS_GROUP_NAME } }),
  });
  return created.resourceName;
}

// A batch Google turned down as a whole (400: bad data in it) fails only its
// own contacts; anything else (reconnect, People API off) stops the sync.
async function rejectedAsEmpty<T extends object>(call: Promise<T>): Promise<T | { error: string }> {
  try {
    return await call;
  } catch (err) {
    if (err instanceof GooglePeopleError && err.status === 400) return { error: err.message };
    throw err;
  }
}

// Google allows 200 contacts per batch call, and asks for one write at a time per account.
const BATCH = 200;

export type CreateResult = { resourceName: string } | { error: string };

// Creates the contacts; results are in the same order as `people`.
export async function batchCreateContacts(people: Omit<GooglePerson, "resourceName">[]): Promise<CreateResult[]> {
  const results: CreateResult[] = [];
  for (let i = 0; i < people.length; i += BATCH) {
    if (i) await sleep(1000);
    const chunk = people.slice(i, i + BATCH);
    const data = await rejectedAsEmpty(
      peopleFetch<{
        createdPeople?: { person?: { resourceName?: string }; status?: { code?: number; message?: string } }[];
      }>(`/people:batchCreateContacts`, {
        method: "POST",
        body: JSON.stringify({ contacts: chunk.map((p) => ({ contactPerson: p })), readMask: "names" }),
      })
    );
    if ("error" in data) {
      chunk.forEach(() => results.push({ error: data.error }));
      continue;
    }
    chunk.forEach((_, j) => {
      const r = data.createdPeople?.[j];
      results.push(
        r?.person?.resourceName && !r.status?.code
          ? { resourceName: r.person.resourceName }
          : { error: r?.status?.message ?? "Google didn't create it." }
      );
    });
  }
  return results;
}

// Updates the given fields (a comma-separated updateMask) on each contact.
// Each person must carry the etag it was read with. Returns an error per
// resourceName that failed.
export async function batchUpdateContacts(
  updates: Map<string, Partial<GooglePerson>>,
  updateMask: string
): Promise<Map<string, string>> {
  const failed = new Map<string, string>();
  const entries = [...updates];
  for (let i = 0; i < entries.length; i += BATCH) {
    if (i) await sleep(1000);
    const chunk = entries.slice(i, i + BATCH);
    const data = await rejectedAsEmpty(
      peopleFetch<{
        updateResult?: Record<string, { httpStatusCode?: number; status?: { code?: number; message?: string } }>;
      }>(`/people:batchUpdateContacts`, {
        method: "POST",
        body: JSON.stringify({ contacts: Object.fromEntries(chunk), updateMask, readMask: "names" }),
      })
    );
    if ("error" in data) {
      for (const [resourceName] of chunk) failed.set(resourceName, data.error);
      continue;
    }
    for (const [resourceName] of chunk) {
      const r = data.updateResult?.[resourceName];
      if (!r || r.status?.code || (r.httpStatusCode && r.httpStatusCode >= 400)) {
        failed.set(resourceName, r?.status?.message ?? "Google didn't update it.");
      }
    }
  }
  return failed;
}
