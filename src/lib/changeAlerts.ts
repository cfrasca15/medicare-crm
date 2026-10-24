import { prisma } from "@/lib/prisma";
import { planGroup } from "@/lib/coverage";
import { canonicalCarrier, looseKey, PLAN_CATALOG } from "@/lib/carriers";
import { groupFamily, loose } from "@/lib/bookOfBusiness";

// Upcoming medical-group and plan changes from Agent Compass, matched against
// clients' current and upcoming plans. Agent Compass serves them at
// /api/crm/changes to anyone with the shared token (AGENT_COMPASS_TOKEN here,
// CRM_API_TOKEN there).

const COMPASS_URL = process.env.AGENT_COMPASS_URL ?? "https://formulary-lookup.onrender.com";

interface CompassChanges {
  generatedAt: string;
  groupPlans: {
    group: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    note: string | null;
    carrier: string;
    planName: string;
    county: string;
  }[];
  planTerminations: { carrier: string; planName: string; county: string | null; endDate: string | null; note: string | null }[];
  groupAlerts: { group: string; carrier: string | null; text: string }[];
}

export interface AffectedClient {
  contactId: string;
  name: string;
  phone: string | null;
  carrier: string;
  planName: string;
  medicalGroup: string | null;
  certain: boolean; // false: same group and carrier, but the plan name isn't one we can match
}

export interface ChangeAlert {
  key: string;
  kind: "group-ending" | "plan-ending" | "group-alert";
  title: string;
  date: string | null;
  note: string | null;
  clients: AffectedClient[];
}

export type ChangeAlertsResult =
  | { status: "off" }
  | { status: "error"; message: string }
  | { status: "ok"; alerts: ChangeAlert[]; quiet: number; checkedAt: string };

async function fetchChanges(): Promise<CompassChanges | { error: string } | null> {
  const token = process.env.AGENT_COMPASS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${COMPASS_URL}/api/crm/changes`, {
      headers: { authorization: `Bearer ${token}` },
      next: { revalidate: 900 },
      // Never hold up a page for long if Agent Compass is slow or down.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { error: `Agent Compass answered ${res.status}.` };
    return (await res.json()) as CompassChanges;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't reach Agent Compass." };
  }
}

// "Hoag Medical Group" matches Agent Compass's "Hoag"; Heritage groups match "Providence".
function groupMatches(clientGroup: string | null, compassGroup: string): boolean {
  if (!clientGroup?.trim()) return false;
  const a = loose(clientGroup);
  const b = loose(compassGroup);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a) || loose(groupFamily(clientGroup) ?? "") === loose(groupFamily(compassGroup) ?? "");
}

const isKnownPlan = (carrier: string, plan: string) =>
  (PLAN_CATALOG[carrier] ?? []).some((p) => looseKey(p) === looseKey(plan));

const fmt = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
};

export async function loadChangeAlerts(now = new Date()): Promise<ChangeAlertsResult> {
  const data = await fetchChanges();
  if (!data) return { status: "off" };
  if ("error" in data) return { status: "error", message: data.error };

  const policies = (
    await prisma.policy.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true, cellPhone: true, cellPreferred: true, county: true } } },
    })
  ).filter((p) => planGroup(p) !== "previous");
  const client = (p: (typeof policies)[number], certain: boolean): AffectedClient => ({
    contactId: p.contact.id,
    name: `${p.contact.firstName} ${p.contact.lastName}`,
    phone: p.contact.cellPreferred && p.contact.cellPhone ? p.contact.cellPhone : p.contact.phone ?? p.contact.cellPhone,
    carrier: p.carrier,
    planName: p.planName,
    medicalGroup: p.medicalGroup,
    certain,
  });
  // Only changes still ahead, or that happened in the last month.
  const recent = (iso: string | null) => !iso || new Date(iso).getTime() >= now.getTime() - 31 * 24 * 60 * 60 * 1000;

  const alerts: ChangeAlert[] = [];

  // A group leaving a carrier's plans: one alert per group, carrier and date.
  const ending = new Map<string, { group: string; carrier: string; endDate: string | null; note: string | null; plans: Set<string> }>();
  for (const g of data.groupPlans) {
    if (g.status !== "ending" || !recent(g.endDate)) continue;
    const carrier = canonicalCarrier(g.carrier);
    const key = `${g.group}|${carrier}|${g.endDate ?? ""}`;
    if (!ending.has(key)) ending.set(key, { group: g.group, carrier, endDate: g.endDate, note: g.note, plans: new Set() });
    ending.get(key)!.plans.add(looseKey(g.planName));
  }
  for (const [key, e] of ending) {
    const clients = policies
      .filter((p) => canonicalCarrier(p.carrier) === e.carrier && groupMatches(p.medicalGroup, e.group))
      .flatMap((p) => {
        if (e.plans.has(looseKey(p.planName))) return [client(p, true)];
        // A plan name we can't match (older or shorthand): flag it to check.
        return isKnownPlan(e.carrier, p.planName) ? [] : [client(p, false)];
      });
    alerts.push({
      key: `g:${key}`,
      kind: "group-ending",
      title: `${e.group} leaves ${e.carrier}${e.endDate ? ` on ${fmt(e.endDate)}` : ""}`,
      date: e.endDate,
      note: e.note,
      clients,
    });
  }

  // Plans the carrier is discontinuing.
  for (const t of data.planTerminations) {
    if (!recent(t.endDate)) continue;
    const carrier = canonicalCarrier(t.carrier);
    const clients = policies
      .filter(
        (p) =>
          canonicalCarrier(p.carrier) === carrier &&
          looseKey(p.planName) === looseKey(t.planName) &&
          (!t.county || !p.contact.county || p.contact.county === t.county)
      )
      .map((p) => client(p, true));
    alerts.push({
      key: `t:${carrier}|${t.planName}|${t.county ?? ""}`,
      kind: "plan-ending",
      title: `${t.planName} ends${t.endDate ? ` ${fmt(t.endDate)}` : ""}${t.county ? ` (${t.county})` : ""}`,
      date: t.endDate,
      note: t.note,
      clients,
    });
  }

  // Warnings (e.g. contract talks) on a group, or a group with one carrier.
  for (const a of data.groupAlerts) {
    const carrier = a.carrier ? canonicalCarrier(a.carrier) : null;
    const clients = policies
      .filter((p) => groupMatches(p.medicalGroup, a.group) && (!carrier || canonicalCarrier(p.carrier) === carrier))
      .map((p) => client(p, true));
    alerts.push({
      key: `a:${a.group}|${carrier ?? ""}|${a.text}`,
      kind: "group-alert",
      title: `Watch: ${a.group}${carrier ? ` and ${carrier}` : ""}`,
      date: null,
      note: a.text,
      clients,
    });
  }

  const withClients = alerts
    .filter((a) => a.clients.length > 0)
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  return { status: "ok", alerts: withClients, quiet: alerts.length - withClients.length, checkedAt: data.generatedAt };
}
