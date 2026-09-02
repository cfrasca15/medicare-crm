import { prisma } from "@/lib/prisma";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const GOOGLE_ACCOUNT_ID = "default";

export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${res.status} ${body}`);
  }

  const data: GoogleTokenResponse = await res.json();
  if (!data.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. Revoke access at https://myaccount.google.com/permissions and try connecting again (Google only issues a refresh token on first consent)."
    );
  }

  const email = await fetchGoogleEmail(data.access_token);

  await prisma.googleAccount.upsert({
    where: { id: GOOGLE_ACCOUNT_ID },
    create: {
      id: GOOGLE_ACCOUNT_ID,
      email,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
    update: {
      email,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "unknown";
  const data = await res.json();
  return data.email ?? "unknown";
}

export async function getGoogleAccount() {
  return prisma.googleAccount.findUnique({ where: { id: GOOGLE_ACCOUNT_ID } });
}

export async function disconnectGoogleAccount(): Promise<void> {
  await prisma.googleAccount.deleteMany({ where: { id: GOOGLE_ACCOUNT_ID } });
}

const EXPIRY_BUFFER_MS = 60_000;

async function getValidAccessToken(): Promise<string> {
  const account = await getGoogleAccount();
  if (!account) throw new Error("Google Calendar isn't connected.");

  if (account.expiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now()) {
    return account.accessToken;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: account.refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed: ${res.status} ${body}`);
  }

  const data: GoogleTokenResponse = await res.json();
  await prisma.googleAccount.update({
    where: { id: GOOGLE_ACCOUNT_ID },
    data: {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

async function googleFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  /** Event date; rendered as a 30-minute block starting at 9:00 AM local time. */
  date: Date;
}

interface CalendarEvent {
  id: string;
  htmlLink: string;
}

function buildEventBody(input: CalendarEventInput) {
  const start = new Date(input.date);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  return {
    summary: input.title,
    description: input.description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  const res = await googleFetch("/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(buildEventBody(input)),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to create calendar event: ${res.status} ${body}`);
  }

  return res.json();
}

export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput
): Promise<CalendarEvent> {
  const res = await googleFetch(`/calendars/primary/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(buildEventBody(input)),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to update calendar event: ${res.status} ${body}`);
  }

  return res.json();
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const res = await googleFetch(`/calendars/primary/events/${eventId}`, {
    method: "DELETE",
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to delete calendar event: ${res.status} ${body}`);
  }
}

export interface UpcomingEvent {
  id: string;
  title: string;
  /** ISO datetime, or ISO date-only ("YYYY-MM-DD") for all-day events. */
  start: string;
  isAllDay: boolean;
  htmlLink: string;
}

async function fetchEvents(params: URLSearchParams): Promise<UpcomingEvent[]> {
  const res = await googleFetch(`/calendars/primary/events?${params}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to list calendar events: ${res.status} ${body}`);
  }

  const data = await res.json();
  const items: Array<{
    id: string;
    summary?: string;
    htmlLink: string;
    start: { dateTime?: string; date?: string };
  }> = data.items ?? [];

  return items.map((item) => ({
    id: item.id,
    title: item.summary ?? "(no title)",
    start: item.start.dateTime ?? item.start.date ?? "",
    isAllDay: !item.start.dateTime,
    htmlLink: item.htmlLink,
  }));
}

export async function listUpcomingEvents(maxResults = 5): Promise<UpcomingEvent[]> {
  return fetchEvents(
    new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: String(maxResults),
      singleEvents: "true",
      orderBy: "startTime",
    })
  );
}

export async function listEventsInRange(
  timeMin: Date,
  timeMax: Date
): Promise<UpcomingEvent[]> {
  return fetchEvents(
    new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: "250",
      singleEvents: "true",
      orderBy: "startTime",
    })
  );
}

async function gmailFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  return fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string; // ISO
  snippet: string;
  isFromMe: boolean;
}

// Gmail's list endpoint only returns {id, threadId} — the subject/from/date
// shown in history requires a follow-up metadata fetch per message, so this
// is capped at maxResults to keep it fast.
export async function listGmailMessagesForContact(
  contactEmail: string,
  maxResults = 10
): Promise<GmailMessageSummary[]> {
  const q = `from:${contactEmail} OR to:${contactEmail}`;
  const listRes = await gmailFetch(
    `/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`
  );

  if (!listRes.ok) {
    const body = await listRes.text().catch(() => "");
    throw new Error(`Failed to list Gmail messages: ${listRes.status} ${body}`);
  }

  const listData = await listRes.json();
  const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);
  if (ids.length === 0) return [];

  const account = await getGoogleAccount();
  const myEmail = account?.email.toLowerCase();

  const messages = await Promise.all(
    ids.map(async (id): Promise<GmailMessageSummary | null> => {
      const res = await gmailFetch(
        `/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
      );
      if (!res.ok) return null;

      const data = await res.json();
      const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
      const from = getHeader("From");

      return {
        id: data.id,
        threadId: data.threadId,
        subject: getHeader("Subject") || "(no subject)",
        from,
        date: new Date(Number(data.internalDate)).toISOString(),
        snippet: data.snippet ?? "",
        isFromMe: myEmail ? from.toLowerCase().includes(myEmail) : false,
      };
    })
  );

  return messages
    .filter((m): m is GmailMessageSummary => m !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function findTextPart(part: GmailPart, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return base64UrlDecode(part.body.data);
  }
  if (part.parts) {
    for (const child of part.parts) {
      const found = findTextPart(child, mimeType);
      if (found) return found;
    }
  }
  return null;
}

// The history list only fetches lightweight metadata (subject/from/date) to
// stay fast across N messages, so the full body is a separate on-demand
// fetch — this walks the (possibly multipart) payload for a text/plain part,
// falling back to a stripped text/html part.
export async function getGmailMessageBody(messageId: string): Promise<string> {
  const res = await gmailFetch(`/users/me/messages/${messageId}?format=full`);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to load message: ${res.status} ${body}`);
  }

  const data = await res.json();
  const payload: GmailPart = data.payload;

  const plain = payload ? findTextPart(payload, "text/plain") : null;
  if (plain) return plain;

  const html = payload ? findTextPart(payload, "text/html") : null;
  if (html) {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return data.snippet ?? "(no content)";
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export async function sendGmailMessage(input: SendEmailInput): Promise<{ id: string }> {
  const account = await getGoogleAccount();
  if (!account) throw new Error("Google account isn't connected.");

  const message = [
    `From: ${account.email}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ].join("\r\n");

  const res = await gmailFetch(`/users/me/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw: base64UrlEncode(message) }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to send email: ${res.status} ${body}`);
  }

  return res.json();
}
