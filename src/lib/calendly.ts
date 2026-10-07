const API_TOKEN = process.env.CALENDLY_API_TOKEN!;
const BASE_URL = "https://api.calendly.com";

async function calendlyFetch(path: string): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
}

export async function getCalendlyUserUri(): Promise<string> {
  const res = await calendlyFetch("/users/me");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Calendly auth failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.resource.uri;
}

export interface CalendlyEventType {
  name: string;
  slug: string;
  url: string;
  // Which booking-link parameter carries the invitee's phone number, if this
  // event type asks for one: "location" when Chris calls the invitee, or
  // "a<N>" when the Nth question on the form is a phone-number question.
  phoneParam: string | null;
}

// The account's bookable event types, read from Calendly so nothing has to
// be configured separately. Cached briefly; they rarely change.
let eventTypesCache: { at: number; types: CalendlyEventType[] } | null = null;

export async function listCalendlyEventTypes(): Promise<CalendlyEventType[]> {
  if (eventTypesCache && Date.now() - eventTypesCache.at < 10 * 60 * 1000) {
    return eventTypesCache.types;
  }
  if (!API_TOKEN) throw new Error("Calendly isn't connected (CALENDLY_API_TOKEN is not set).");

  const userUri = await getCalendlyUserUri();
  const params = new URLSearchParams({ user: userUri, active: "true" });
  const res = await calendlyFetch(`/event_types?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Calendly event types fetch failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  const items: Array<{
    name: string;
    slug: string;
    scheduling_url: string;
    locations?: Array<{ kind: string }> | null;
    custom_questions?: Array<{ type: string; position: number; enabled: boolean }> | null;
  }> = data.collection ?? [];

  const types = items.map((item) => {
    const phoneQuestion = (item.custom_questions ?? [])
      .filter((q) => q.enabled)
      .sort((a, b) => a.position - b.position)
      .findIndex((q) => q.type === "phone_number");
    const callsInvitee = (item.locations ?? []).some((l) => l.kind === "outbound_call");
    return {
      name: item.name.trim(),
      slug: item.slug,
      url: item.scheduling_url,
      phoneParam: callsInvitee ? "location" : phoneQuestion >= 0 ? `a${phoneQuestion + 1}` : null,
    };
  });

  eventTypesCache = { at: Date.now(), types };
  return types;
}

export interface CalendlyEvent {
  uri: string;
  name: string;
  status: string;
  startTime: string;
  endTime: string;
  location: string | null;
}

export interface CalendlyInvitee {
  name: string;
  email: string | null;
  questionsAndAnswers: { question: string; answer: string }[];
}

export async function listUpcomingCalendlyEvents(
  daysAhead = 90
): Promise<CalendlyEvent[]> {
  const userUri = await getCalendlyUserUri();

  const minStartTime = new Date();
  const maxStartTime = new Date();
  maxStartTime.setDate(maxStartTime.getDate() + daysAhead);

  const params = new URLSearchParams({
    user: userUri,
    status: "active",
    sort: "start_time:asc",
    min_start_time: minStartTime.toISOString(),
    max_start_time: maxStartTime.toISOString(),
    count: "100",
  });

  const res = await calendlyFetch(`/scheduled_events?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Calendly events fetch failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const items: Array<{
    uri: string;
    name: string;
    status: string;
    start_time: string;
    end_time: string;
    location?: { type?: string; location?: string; join_url?: string };
  }> = data.collection ?? [];

  return items.map((item) => ({
    uri: item.uri,
    name: item.name,
    status: item.status,
    startTime: item.start_time,
    endTime: item.end_time,
    location: item.location?.join_url ?? item.location?.location ?? item.location?.type ?? null,
  }));
}

export async function listEventInvitees(eventUri: string): Promise<CalendlyInvitee[]> {
  const uuid = eventUri.split("/").pop();
  const res = await calendlyFetch(`/scheduled_events/${uuid}/invitees`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Calendly invitees fetch failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const items: Array<{
    name: string;
    email?: string;
    questions_and_answers?: { question: string; answer: string }[];
  }> = data.collection ?? [];
  return items.map((item) => ({
    name: item.name,
    email: item.email ?? null,
    questionsAndAnswers: item.questions_and_answers ?? [],
  }));
}
