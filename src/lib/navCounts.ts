import { prisma } from "@/lib/prisma";
import { dateInputValue, todayInputValue } from "@/lib/date";
import { aepSeason, loadAepWorklist } from "@/lib/aep";
import { loadChangeAlerts } from "@/lib/changeAlerts";
import { loadNeedsReply, type NeedsReplyResult } from "@/lib/needsReply";

// The little counts next to the menu's "To do" links. Keyed by the link's
// address; a link with nothing waiting gets no badge at all.
export interface NavBadge {
  text: string;
  // Red: something is past due.
  alert?: boolean;
  // Spelled out for the tooltip and screen readers: "1 overdue, 2 due today".
  title: string;
}
export type NavCounts = Record<string, NavBadge>;

// The menu asks for its counts on every page change, so anything slow is
// remembered for a while. Past `ttlMs` the old answer is still handed back
// straight away while a fresh one loads for next time, unless `wait` is set,
// in which case the caller waits for the fresh one. `fresh` skips the
// remembered answer altogether: something was just saved.
type Remembered = { at: number; has: boolean; value: unknown; loading: Promise<unknown> | null };
const remembered = new Map<string, Remembered>();

async function remember<T>(key: string, ttlMs: number, wait: boolean, load: () => Promise<T>, fresh = false): Promise<T> {
  let entry = remembered.get(key);
  if (!entry) {
    entry = { at: 0, has: false, value: undefined, loading: null };
    remembered.set(key, entry);
  }
  const e = entry;
  // A recount already under way (after a save) beats the remembered answer.
  if (e.loading && wait && !fresh) return e.loading as Promise<T>;
  if (e.has && !fresh && Date.now() - e.at < ttlMs) return e.value as T;

  // One check at a time, however many pages ask (a check that began before
  // a save is no good to the page asking after it).
  if (!e.loading || fresh) {
    const loading: Promise<unknown> = load()
      .then((value) => {
        e.value = value;
        e.has = true;
        e.at = Date.now();
        return value;
      })
      .finally(() => {
        if (e.loading === loading) e.loading = null;
      });
    e.loading = loading;
  }
  if (e.has && !wait) {
    e.loading.catch(() => {});
    return e.value as T;
  }
  return e.loading as Promise<T>;
}

// The Needs a Reply page checks Gmail itself each visit; it hands its answer
// over so the menu's badge matches what the page just showed.
export function rememberNeedsReply(result: NeedsReplyResult) {
  remembered.set("inbox", { at: Date.now(), has: true, value: result, loading: null });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Tasks due today or earlier. Calendly bookings are appointments, not to-dos.
async function tasksBadge(today: string): Promise<NavBadge | null> {
  const tasks = await prisma.task.findMany({
    where: { status: "OPEN", calendlyEventUri: null, dueDate: { not: null } },
    select: { dueDate: true },
  });
  const days = tasks.map((t) => dateInputValue(t.dueDate!));
  const overdue = days.filter((d) => d < today).length;
  const dueToday = days.filter((d) => d === today).length;
  if (!overdue && !dueToday) return null;
  return {
    text: String(overdue + dueToday),
    alert: overdue > 0,
    title: [overdue && `${overdue} overdue`, dueToday && `${dueToday} due today`].filter(Boolean).join(", "),
  };
}

// Open service requests; red when a follow-up date has come.
async function serviceBadge(today: string): Promise<NavBadge | null> {
  const open = await prisma.serviceRequest.findMany({
    where: { status: { not: "resolved" } },
    select: { followUpOn: true },
  });
  if (!open.length) return null;
  const due = open.filter((r) => r.followUpOn && dateInputValue(r.followUpOn) <= today).length;
  return {
    text: String(open.length),
    alert: due > 0,
    title: `${open.length} open${due ? `, ${plural(due, "follow-up")} due` : ""}`,
  };
}

// Gmail conversations waiting on a reply. Checking Gmail takes dozens of
// requests, so it's looked at once every few minutes at most.
export const needsReplyRecent = () => remember("inbox", 3 * 60_000, false, loadNeedsReply);

async function inboxBadge(): Promise<NavBadge | null> {
  const result = await needsReplyRecent();
  if (result.status !== "ok") return null;
  const count = result.fromContacts.length + result.others.length;
  if (!count) return null;
  return {
    text: String(count),
    title: `${plural(count, "conversation")} waiting, ${result.fromContacts.length} from contacts`,
  };
}

// Clients affected by a plan or medical group change.
async function alertsBadge(fresh: boolean): Promise<NavBadge | null> {
  const result = await remember("alerts", 5 * 60_000, true, () => loadChangeAlerts(), fresh);
  if (result.status !== "ok") return null;
  const affected = new Set(result.alerts.flatMap((a) => a.clients.map((c) => c.contactId))).size;
  if (!affected) return null;
  return { text: String(affected), title: `${plural(affected, "client")} affected` };
}

// How far through this year's AEP reviews, Oct 1 – Dec 7 only.
async function aepBadge(fresh: boolean): Promise<NavBadge | null> {
  if (!aepSeason().active) return null;
  const { counts } = await remember("aep", 20_000, true, () => loadAepWorklist(), fresh);
  if (!counts.total) return null;
  return {
    text: `${counts.reviewed}/${counts.total}`,
    alert: counts.urgentLeft > 0,
    title: `${counts.reviewed} of ${counts.total} reviewed${counts.urgentLeft ? `, ${counts.urgentLeft} urgent left` : ""}`,
  };
}

// `fresh`: something was just saved, so recount what comes from the CRM's own
// records rather than reuse a remembered answer. Gmail keeps its own pace.
export async function loadNavCounts(fresh = false): Promise<NavCounts> {
  const today = todayInputValue();
  // One count failing (Gmail down, say) shouldn't blank the others.
  const safe = (badge: Promise<NavBadge | null>) => badge.catch(() => null);
  const [aep, tasks, inbox, service, alerts] = await Promise.all([
    safe(aepBadge(fresh)),
    safe(tasksBadge(today)),
    safe(inboxBadge()),
    safe(serviceBadge(today)),
    safe(alertsBadge(fresh)),
  ]);

  const counts: NavCounts = {};
  const put = (href: string, badge: NavBadge | null) => {
    if (badge) counts[href] = badge;
  };
  put("/aep", aep);
  put("/tasks", tasks);
  put("/inbox", inbox);
  put("/service", service);
  put("/alerts", alerts);
  return counts;
}
