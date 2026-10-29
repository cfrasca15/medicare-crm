import { prisma } from "@/lib/prisma";
import { dateInputValue, todayInputValue } from "@/lib/date";
import { getGoogleAccount, listEventsInRange, sendGmailMessage } from "@/lib/google";
import { loadServiceRequests } from "@/lib/serviceQueries";
import { loadChangeAlerts } from "@/lib/changeAlerts";
import { loadNeedsReply, senderName, waitingFor } from "@/lib/needsReply";
import { loadUnpaid } from "@/lib/unpaidCommissions";

// The morning email to yourself (the connected Google account): today's
// appointments and to-dos, emails waiting on a reply, follow-ups, birthdays,
// people turning 65, new leads, change alerts and unpaid commissions, each
// with a link into the CRM. Sent by scheduledJobs.ts; empty sections are left out.

const TZ = "America/Los_Angeles";
const MAX_LINES = 10;

const pacificDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const pacificTime = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
// "Failed to list …: 401 {…json…}" -> "Failed to list …: 401"
const shortError = (err: unknown) => (err instanceof Error ? err.message : String(err)).replace(/\s*[{[][\s\S]*$/, "").slice(0, 200);

// Where links in the email point: CRM_URL, or the server address the Google
// sign-in already uses.
function crmUrl(): string {
  if (process.env.CRM_URL) return process.env.CRM_URL.replace(/\/+$/, "");
  try {
    return new URL(process.env.GOOGLE_REDIRECT_URI ?? "").origin;
  } catch {
    return "";
  }
}

// At most MAX_LINES lines, then "…and N more".
function capped(lines: string[]): string[] {
  return lines.length <= MAX_LINES ? lines : [...lines.slice(0, MAX_LINES), `  …and ${lines.length - MAX_LINES} more`];
}

export async function buildMorningDigest(now = new Date()): Promise<{ subject: string; body: string }> {
  const base = crmUrl();
  const link = (path: string) => `${base}${path}`;
  const today = todayInputValue(now);
  const [y, m, d] = today.split("-").map(Number);

  const [openTasks, openRequests, people, newContacts, needsReply, alerts, unpaid] = await Promise.all([
    prisma.task.findMany({
      where: { status: "OPEN", calendlyEventUri: null, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      include: { contact: { select: { firstName: true, lastName: true } } },
    }),
    loadServiceRequests("open"),
    prisma.contact.findMany({
      where: { dateOfBirth: { not: null }, stage: { not: "LOST" } },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
    }),
    prisma.contact.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 24 * 3600 * 1000) } },
      select: { id: true, firstName: true, lastName: true, leadSource: true },
      orderBy: { createdAt: "asc" },
    }),
    loadNeedsReply(),
    loadChangeAlerts(),
    loadUnpaid(now),
  ]);

  const sections: { heading: string; lines: string[] }[] = [];

  // Appointments: today's Google Calendar events (Calendly bookings land there too).
  let appointments: string[] = [];
  try {
    const events = await listEventsInRange(new Date(now.getTime() - 24 * 3600 * 1000), new Date(now.getTime() + 2 * 24 * 3600 * 1000));
    appointments = events
      .filter((e) => !/^cancell?ed\b/i.test(e.title.trim()))
      .filter((e) => (e.isAllDay ? e.start : pacificDay(new Date(e.start))) === today)
      .map((e) => `- ${e.isAllDay ? "All day" : pacificTime(new Date(e.start))}  ${e.title}`);
  } catch (err) {
    appointments = [`- Couldn't read your calendar: ${shortError(err)}`];
  }
  sections.push({ heading: "APPOINTMENTS TODAY", lines: appointments.length ? appointments : ["- None"] });

  // To-dos due today or earlier. Due dates are calendar dates (see date.ts).
  const taskLine = (t: (typeof openTasks)[number]) =>
    `- ${t.title}${t.contact ? ` (${t.contact.firstName} ${t.contact.lastName})` : ""}`;
  const overdue = openTasks.filter((t) => dateInputValue(t.dueDate!) < today);
  const dueToday = openTasks.filter((t) => dateInputValue(t.dueDate!) === today);
  const todo = [
    ...capped(dueToday.map(taskLine)),
    ...(overdue.length ? [`- Plus ${plural(overdue.length, "overdue task")}`] : []),
  ];
  sections.push({ heading: `TO DO TODAY  ${link("/tasks")}`, lines: todo.length ? todo : ["- Nothing due"] });

  if (needsReply.status === "ok") {
    const lines = capped(
      needsReply.fromContacts.map(
        (t) => `- ${t.contactName}: "${t.subject}" (waiting ${waitingFor(t.date, now)})${t.unread ? ", unread" : ""}`
      )
    );
    if (needsReply.others.length) {
      const names = [...new Set(needsReply.others.map((t) => senderName(t.from)))].slice(0, 5).join(", ");
      lines.push(`- Plus ${plural(needsReply.others.length, "other email")}: ${names}${needsReply.others.length > 5 ? ", …" : ""}`);
    }
    if (lines.length) sections.push({ heading: `EMAILS WAITING ON A REPLY  ${link("/inbox")}`, lines });
  } else if (needsReply.status === "error") {
    sections.push({ heading: "EMAILS WAITING ON A REPLY", lines: [`- Couldn't check Gmail: ${shortError(needsReply.message)}`] });
  }

  const serviceDue = openRequests.filter((r) => r.followUpOn && dateInputValue(r.followUpOn) <= today);
  if (serviceDue.length) {
    sections.push({
      heading: `SERVICE FOLLOW-UPS DUE  ${link("/service")}`,
      lines: capped(serviceDue.map((r) => `- ${r.contact.firstName} ${r.contact.lastName}: ${r.title}`)),
    });
  }

  // Birthdays today, and 65th birthdays in the next 30 days (Initial Enrollment Period).
  const birthdays = people.filter((p) => p.dateOfBirth!.getUTCMonth() === m - 1 && p.dateOfBirth!.getUTCDate() === d);
  if (birthdays.length) {
    sections.push({
      heading: `BIRTHDAYS TODAY  ${link("/birthdays")}`,
      lines: birthdays.map((p) => `- ${p.firstName} ${p.lastName}, ${y - p.dateOfBirth!.getUTCFullYear()}`),
    });
  }
  const todayUtc = Date.UTC(y, m - 1, d);
  const turning65 = people
    .map((p) => {
      const dob = p.dateOfBirth!;
      return { p, days: Math.round((Date.UTC(dob.getUTCFullYear() + 65, dob.getUTCMonth(), dob.getUTCDate()) - todayUtc) / 86_400_000) };
    })
    .filter((x) => x.days >= 0 && x.days <= 30)
    .sort((a, b) => a.days - b.days);
  if (turning65.length) {
    sections.push({
      heading: `TURNING 65 IN THE NEXT 30 DAYS  ${link("/birthdays")}`,
      lines: capped(turning65.map(({ p, days }) => `- ${p.firstName} ${p.lastName}, ${days === 0 ? "today" : `in ${plural(days, "day")}`}`)),
    });
  }

  if (newContacts.length) {
    sections.push({
      heading: `NEW CONTACTS SINCE YESTERDAY  ${link("/contacts")}`,
      lines: capped(newContacts.map((c) => `- ${c.firstName} ${c.lastName}${c.leadSource ? ` (${c.leadSource})` : ""}`)),
    });
  }

  if (alerts.status === "ok" && alerts.alerts.length) {
    const affected = new Set(alerts.alerts.flatMap((a) => a.clients.map((c) => c.contactId))).size;
    sections.push({
      heading: `PLAN AND GROUP CHANGES  ${link("/alerts")}`,
      lines: [`- ${plural(alerts.alerts.length, "change")} affecting ${plural(affected, "client")}`],
    });
  }

  if (unpaid.length) {
    const total = unpaid.reduce((s, p) => s + (p.commissionAmount ?? 0), 0);
    sections.push({
      heading: `COMMISSIONS TO CHASE  ${link("/commissions")}`,
      lines: [`- ${plural(unpaid.length, "plan")} started 60+ days ago with nothing paid yet (${money(total)} expected)`],
    });
  }

  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const waiting = needsReply.status === "ok" ? needsReply.fromContacts.length : 0;
  const subject = [
    `CRM ${dateLabel.split(",")[0]}`,
    plural(appointments.filter((l) => !l.startsWith("- Couldn't")).length, "appointment"),
    plural(dueToday.length + overdue.length, "to-do"),
    ...(waiting ? [`${plural(waiting, "email")} waiting`] : []),
  ].join(" · ");

  const body = [
    `Good morning. Here's ${dateLabel}.`,
    ...sections.map((s) => `\n${s.heading}\n${s.lines.join("\n")}`),
    `\nOpen the CRM: ${link("/")}`,
  ].join("\n");

  return { subject, body };
}

export async function sendMorningDigest(): Promise<void> {
  const account = await getGoogleAccount();
  if (!account) return;
  const { subject, body } = await buildMorningDigest();
  await sendGmailMessage({ to: account.email, subject, body, noSignature: true });
}
