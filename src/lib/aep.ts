import { prisma } from "@/lib/prisma";
import { planGroup } from "@/lib/coverage";
import { loadChangeAlerts } from "@/lib/changeAlerts";
import { primaryPhone } from "@/lib/phone";
import { todayInputValue } from "@/lib/date";
import { AEP_STATUSES, isReviewed } from "@/lib/aepStatuses";

// The AEP worklist: every client with a plan, and where each stands in this
// year's Annual Enrollment Period review (Oct 15 – Dec 7).

// Call outcomes that mean we tried but didn't get to talk.
const MESSAGE_OUTCOMES = ["voicemail", "no_answer", "texted"];

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

// The worklist follows one AEP from Oct 1 (when prep starts) until the next
// Oct 1, so after Dec 7 it still shows how that season went.
export function aepSeason(now = new Date()) {
  const today = todayInputValue(now);
  const thisYear = Number(today.slice(0, 4));
  const year = today.slice(5) >= "10-01" ? thisYear : thisYear - 1;
  const prepStart = `${year}-10-01`;
  const start = `${year}-10-15`;
  const end = `${year}-12-07`;
  return {
    year,
    planYear: year + 1,
    prepStart,
    // Oct 1 – Dec 7: the worklist is the thing to be working on.
    active: today >= prepStart && today <= end,
    started: today >= start,
    ended: today > end,
    daysToStart: Math.max(0, daysBetween(today, start)),
    daysLeft: Math.max(0, daysBetween(today, end)),
  };
}

export type AepFlag = { label: string; tone: "urgent" | "heads-up" | "new" | "quiet" };

export interface AepRow {
  contactId: string;
  name: string;
  lastName: string;
  age: number | null;
  phone: string | null;
  plan: string | null;
  nextPlan: string | null; // a plan already added for next year
  flags: AepFlag[];
  status: string;
  // Where the status came from when it wasn't set by hand.
  autoReason: string | null;
  lastCall: { outcome: string | null; at: Date } | null;
  nextTask: { title: string; dueDate: Date } | null;
  urgent: boolean;
  medSupp: boolean;
}

// "SCAN SCAN Classic (HMO)" reads as just "SCAN Classic (HMO)".
const planLabel = (p: { carrier: string; planName: string }) =>
  p.planName.toLowerCase().startsWith(p.carrier.toLowerCase()) ? p.planName : `${p.carrier} ${p.planName}`;

const isMedSupp = (p: { planType: string | null; planName: string }) =>
  /supp|medigap/i.test(`${p.planType ?? ""} ${p.planName}`);

function ageOn(dob: Date, today: string): number {
  const [y, m, d] = today.split("-").map(Number);
  let age = y - dob.getUTCFullYear();
  if (m < dob.getUTCMonth() + 1 || (m === dob.getUTCMonth() + 1 && d < dob.getUTCDate())) age--;
  return age;
}

export async function loadAepWorklist(now = new Date()) {
  const season = aepSeason(now);
  const today = todayInputValue(now);
  const seasonStart = new Date(`${season.prepStart}T00:00:00-07:00`);
  const nextJan1 = new Date(Date.UTC(season.planYear, 0, 1));
  const thisJan1 = new Date(Date.UTC(season.year, 0, 1));

  const [contacts, alerts] = await Promise.all([
    prisma.contact.findMany({
      where: { stage: { not: "LOST" }, policies: { some: {} } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        cellPhone: true,
        cellPreferred: true,
        dateOfBirth: true,
        policies: {
          select: {
            carrier: true,
            planName: true,
            planType: true,
            timing: true,
            effectiveDate: true,
            termDate: true,
            createdAt: true,
          },
        },
        aepReviews: { where: { year: season.year }, select: { status: true } },
        activities: {
          where: { type: "call" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { outcome: true, createdAt: true },
        },
        tasks: {
          where: { status: "OPEN", dueDate: { gte: new Date(`${today}T00:00:00Z`) } },
          orderBy: { dueDate: "asc" },
          take: 1,
          select: { title: true, dueDate: true, calendlyEventUri: true },
        },
      },
    }),
    loadChangeAlerts(now),
  ]);

  // Clients named in Change Alerts, with the most serious kind for each.
  const alertFlags = new Map<string, AepFlag>();
  if (alerts.status === "ok") {
    for (const a of alerts.alerts) {
      const flag: AepFlag =
        a.kind === "plan-ending"
          ? { label: "Plan ending", tone: "urgent" }
          : a.kind === "group-ending"
            ? { label: "Group leaving", tone: "urgent" }
            : { label: "Heads up", tone: "heads-up" };
      for (const c of a.clients) {
        const had = alertFlags.get(c.contactId);
        if (!had || (had.tone !== "urgent" && flag.tone === "urgent")) alertFlags.set(c.contactId, flag);
      }
    }
  }

  const rows: AepRow[] = [];
  for (const c of contacts) {
    const current = c.policies.filter((p) => planGroup(p, now) === "current");
    // Only someone with a plan in force has anything to review; a brand-new
    // client whose first plan hasn't started yet just enrolled.
    if (!current.length) continue;
    const shown = current.sort((a, b) => (b.effectiveDate?.getTime() ?? 0) - (a.effectiveDate?.getTime() ?? 0))[0];
    const next = c.policies.find(
      (p) => planGroup(p, now) === "future" && (!p.effectiveDate || p.effectiveDate >= nextJan1) && p.createdAt >= seasonStart
    );
    const medSupp = current.every(isMedSupp);
    const firstStart = c.policies
      .map((p) => p.effectiveDate)
      .filter((d): d is Date => d != null)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const flags: AepFlag[] = [];
    const alertFlag = alertFlags.get(c.id);
    if (alertFlag) flags.push(alertFlag);
    if (firstStart && firstStart >= thisJan1) flags.push({ label: "First AEP", tone: "new" });
    if (medSupp) flags.push({ label: "Med Supp", tone: "quiet" });

    // A status set on the worklist wins; otherwise work it out.
    const lastCall = c.activities[0] ?? null;
    const task = c.tasks[0] ?? null;
    let status = c.aepReviews[0]?.status ?? "not_contacted";
    let autoReason: string | null = null;
    if (!c.aepReviews.length) {
      if (next) {
        status = "switching";
        autoReason = "New plan added";
      } else if (task?.calendlyEventUri) {
        status = "scheduled";
        autoReason = "Booked on Calendly";
      } else if (lastCall && lastCall.createdAt >= seasonStart && MESSAGE_OUTCOMES.includes(lastCall.outcome ?? "")) {
        status = "left_message";
        autoReason = "From logged call";
      }
    }

    const phone = primaryPhone(c);
    rows.push({
      contactId: c.id,
      name: `${c.firstName} ${c.lastName}`,
      lastName: c.lastName,
      age: c.dateOfBirth ? ageOn(c.dateOfBirth, today) : null,
      phone: phone?.number ?? null,
      plan: planLabel(shown),
      nextPlan: next ? planLabel(next) : null,
      flags,
      status,
      autoReason,
      lastCall: lastCall ? { outcome: lastCall.outcome, at: lastCall.createdAt } : null,
      nextTask: task?.dueDate ? { title: task.title, dueDate: task.dueDate } : null,
      urgent: alertFlag?.tone === "urgent",
      medSupp,
    });
  }

  // Urgent first, then everyone else, Med Supp last; reviewed clients at the
  // bottom. Within each, least far along first.
  const order = AEP_STATUSES.map((s) => s.value);
  const rank = (r: AepRow) =>
    isReviewed(r.status) ? 4 : r.urgent ? 0 : r.flags.some((f) => f.tone === "heads-up") ? 1 : r.medSupp ? 3 : 2;
  rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      order.indexOf(a.status) - order.indexOf(b.status) ||
      a.lastName.localeCompare(b.lastName) ||
      a.name.localeCompare(b.name)
  );

  const reviewed = rows.filter((r) => isReviewed(r.status)).length;
  return {
    season,
    rows,
    alertsStatus: alerts.status,
    counts: {
      total: rows.length,
      reviewed,
      urgentLeft: rows.filter((r) => r.urgent && !isReviewed(r.status)).length,
      notContacted: rows.filter((r) => r.status === "not_contacted").length,
      staying: rows.filter((r) => r.status === "staying").length,
      switching: rows.filter((r) => r.status === "switching").length,
    },
  };
}
