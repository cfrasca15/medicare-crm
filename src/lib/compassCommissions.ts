import { canonicalCarrier, planKey } from "@/lib/carrierNames";
import { COMMISSION_RATES, STANDARD_MAPD_RATES } from "@/lib/commissionRates";

// Commission amounts for the Commission Amount dropdown, read from Agent
// Compass's Commissions page (/api/crm/commissions, same token as Change
// Alerts). Each dollar amount in a schedule's table becomes one choice. If
// Agent Compass can't be reached, the built-in list in commissionRates.ts is
// used instead.

const COMPASS_URL = process.env.AGENT_COMPASS_URL ?? "https://formulary-lookup.onrender.com";

export interface RateOption {
  label: string;
  amount: number;
}

// A plan Agent Compass marks as paying no (or reduced) commission.
export interface CommissionFlagInfo {
  carrier: string; // standard carrier name
  planKey: string | null;
  planId: string | null;
  county: string | null;
  label: string;
  zero: boolean; // pays nothing (to new enrollments at least)
}

export interface CommissionChoices {
  source: "compass" | "builtin";
  // By standard carrier name; carriers not listed get `standard`.
  byCarrier: Record<string, RateOption[]>;
  standard: RateOption[];
  flags: CommissionFlagInfo[];
}

interface Schedule {
  carrier: string;
  product: string;
  title: string;
  status: string;
  columns: string[];
  rows: string[][];
}
interface Flag {
  carrier: string;
  planId: string | null;
  planName: string | null;
  county: string | null;
  kind: string;
  note: string | null;
}

const FLAG_LABEL: Record<string, string> = {
  none: "Non-commissionable",
  newnone: "New enrollments non-commissionable",
  reduced: "Reduced renewals",
  broker: "Not broker friendly",
};

const AMOUNT = /^\$\s?([\d,]+(?:\.\d+)?)/;

// One cell's choices: "$902" -> 902; "$37.58 per month ($451 a year)" -> 451;
// "$390 if ... · $255 for ..." -> two choices. Percentages are skipped.
function cellChoices(cell: string, perMonth: boolean): { amount: number; detail: string | null }[] {
  return cell
    .split(" · ")
    .map((part) => part.trim())
    .flatMap((part) => {
      const m = part.match(AMOUNT);
      if (!m) return [];
      let amount = Number(m[1].replace(/,/g, ""));
      const yearly = part.match(/\(\$([\d,]+(?:\.\d+)?) a year\)/);
      // What follows the amount, minus "a year," and wrapping parentheses.
      let detail =
        part
          .slice(m[0].length)
          .trim()
          .replace(/^a year\b[,;]?\s*/i, "")
          .replace(/^\((.*)\)$/, "$1")
          .trim() || null;
      if (yearly) {
        amount = Number(yearly[1].replace(/,/g, ""));
        detail = `${m[0]} a month`;
      } else if (perMonth || /^per month\b/i.test(detail ?? "")) {
        // Per-month rates are shown as the yearly amount, like the others.
        detail = `${m[0]} a month${detail && !/^per month\b/i.test(detail) ? ` ${detail}` : ""}`;
        amount = Math.round(amount * 12 * 100) / 100;
      }
      return Number.isFinite(amount) ? [{ amount, detail }] : [];
    });
}

export function parseSchedules(schedules: Schedule[]): Record<string, RateOption[]> {
  const out: Record<string, RateOption[]> = {};
  const live = schedules.filter((s) => s.status !== "previous");
  for (const s of live) {
    // Payment-timing tables (one row per effective month) aren't amounts to pick.
    if (/effective date|months enrolled/i.test(s.columns[0] ?? "")) continue;
    const carrier = canonicalCarrier(s.carrier);
    const perMonth = /per member per month|\bpmpm\b/i.test(s.title);
    // Say which schedule when the carrier has a current and an upcoming one.
    const both = live.some((o) => o !== s && o.carrier === s.carrier && o.product === s.product && o.status !== s.status);
    const prefix = s.product === "Med Supp" ? "Med Supp: " : "";
    const suffix = both ? ` (${s.status})` : "";
    for (const row of s.rows) {
      const cells = row.map((c) => String(c ?? "").trim());
      // The leading cells without a dollar amount name the row.
      const firstAmount = cells.findIndex((c) => AMOUNT.test(c) || /^\d+(\.\d+)?%/.test(c));
      if (firstAmount <= 0) continue;
      const name = cells.slice(0, firstAmount).filter(Boolean).join(", ");
      for (let i = firstAmount; i < cells.length; i++) {
        for (const c of cellChoices(cells[i], perMonth)) {
          // A two-column table's amount heading ("What SCAN pays") adds nothing.
          const column = s.columns.length > 2 ? `, ${s.columns[i] ?? ""}` : "";
          const label = `${prefix}${name}${column}${c.detail ? ` (${c.detail})` : ""}${suffix}`;
          const list = (out[carrier] ??= []);
          if (!list.some((x) => x.label === label && x.amount === c.amount)) list.push({ label, amount: c.amount });
        }
      }
    }
  }
  // A carrier with only a Med Supp schedule still sells Medicare Advantage.
  for (const carrier of Object.keys(out))
    if (!live.some((s) => s.product !== "Med Supp" && canonicalCarrier(s.carrier) === carrier)) out[carrier].unshift(...STANDARD_MAPD_RATES);
  return out;
}

function parseFlags(flags: Flag[]): CommissionFlagInfo[] {
  return flags
    .filter((f) => FLAG_LABEL[f.kind])
    .map((f) => ({
      carrier: canonicalCarrier(f.carrier),
      planKey: f.planName ? planKey(f.planName) : null,
      planId: f.planId,
      county: f.county,
      label: `${FLAG_LABEL[f.kind]}${f.note ? `: ${f.note}` : ""}`,
      zero: f.kind === "none" || f.kind === "newnone",
    }));
}

function builtin(): CommissionChoices {
  const byCarrier: Record<string, RateOption[]> = {};
  for (const r of COMMISSION_RATES) (byCarrier[canonicalCarrier(r.carrier)] ??= []).push({ label: `${r.carrier} ${r.label}`, amount: r.amount });
  return { source: "builtin", byCarrier, standard: STANDARD_MAPD_RATES, flags: [] };
}

// Kept for 30 minutes; a stale copy is used right away while a fresh one
// loads, so a slow Agent Compass never holds up a contact page.
let cache: { at: number; value: CommissionChoices } | null = null;
let loading: Promise<CommissionChoices | null> | null = null;
const TTL = 30 * 60 * 1000;

async function fetchChoices(): Promise<CommissionChoices | null> {
  const token = process.env.AGENT_COMPASS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${COMPASS_URL}/api/crm/commissions`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { schedules: Schedule[]; flags: Flag[] };
    const byCarrier = parseSchedules(data.schedules ?? []);
    if (!Object.keys(byCarrier).length) return null;
    return { source: "compass", byCarrier, standard: STANDARD_MAPD_RATES, flags: parseFlags(data.flags ?? []) };
  } catch {
    return null;
  }
}

export async function loadCommissionChoices(): Promise<CommissionChoices> {
  const fresh = cache && Date.now() - cache.at < TTL;
  if (!fresh && !loading) {
    loading = fetchChoices().then((v) => {
      if (v) cache = { at: Date.now(), value: v };
      // Unreachable: use the built-in list and try again in 5 minutes.
      else if (!cache) cache = { at: Date.now() - TTL + 5 * 60 * 1000, value: builtin() };
      loading = null;
      return v;
    });
  }
  if (cache) return cache.value;
  return (await loading) ?? builtin();
}
