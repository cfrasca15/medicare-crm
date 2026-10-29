import { prisma } from "@/lib/prisma";
import { getGoogleAccount, listThreadsAwaitingReply, type AwaitingReplyThread } from "@/lib/google";

// Gmail conversations waiting on your reply (see listThreadsAwaitingReply),
// split into ones from contacts (their own email or the person who speaks
// for them) and everyone else. Shown on /inbox and in the morning digest.

export interface NeedsReplyItem extends AwaitingReplyThread {
  contactId: string | null;
  contactName: string | null;
}

export type NeedsReplyResult =
  | { status: "ok"; fromContacts: NeedsReplyItem[]; others: NeedsReplyItem[] }
  | { status: "off" }
  | { status: "error"; message: string };

// Senders that never want an answer.
const AUTOMATED = /(^|[._-])(no-?reply|do-?not-?reply|notifications?|mailer-daemon|bounces?|alerts?)([._-]|@)/i;

export async function loadNeedsReply(): Promise<NeedsReplyResult> {
  if (!(await getGoogleAccount())) return { status: "off" };

  let threads: AwaitingReplyThread[];
  try {
    threads = await listThreadsAwaitingReply();
  } catch (err) {
    // Drop the JSON body Google adds to error messages.
    const message = (err instanceof Error ? err.message : String(err)).replace(/\s*[{[][\s\S]*$/, "");
    return { status: "error", message };
  }

  const contacts = await prisma.contact.findMany({
    where: { OR: [{ email: { not: null } }, { altContactEmail: { not: null } }] },
    select: { id: true, firstName: true, lastName: true, email: true, altContactEmail: true, altContactName: true },
  });
  const byEmail = new Map<string, { id: string; name: string }>();
  for (const c of contacts) {
    const name = `${c.firstName} ${c.lastName}`.trim();
    if (c.email) byEmail.set(c.email.trim().toLowerCase(), { id: c.id, name });
    const alt = c.altContactEmail?.trim().toLowerCase();
    if (alt && !byEmail.has(alt)) byEmail.set(alt, { id: c.id, name: `${name} (${c.altContactName || "their contact"})` });
  }

  const fromContacts: NeedsReplyItem[] = [];
  const others: NeedsReplyItem[] = [];
  for (const t of threads) {
    const contact = byEmail.get(t.fromEmail);
    if (contact) fromContacts.push({ ...t, contactId: contact.id, contactName: contact.name });
    else if (!t.bulk && !AUTOMATED.test(t.fromEmail)) others.push({ ...t, contactId: null, contactName: null });
  }
  return { status: "ok", fromContacts, others };
}

// "Pat Lee <pat@example.com>" -> "Pat Lee"; a bare address stays as is.
export function senderName(from: string): string {
  const name = from.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  return name || from;
}

// How long it's been waiting: "2 hours", "3 days".
export function waitingFor(iso: string, now = new Date()): string {
  const hours = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
