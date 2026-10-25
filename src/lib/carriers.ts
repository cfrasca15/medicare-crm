import catalog from "@/lib/planCatalog.json";
import { CARRIER_NAMES, CARRIER_WORDS, canonicalCarrier, looseKey, planBody, planKey } from "@/lib/carrierNames";

export * from "@/lib/carrierNames";

interface Catalog {
  carriers: Record<string, string[]>;
  counties: Record<string, Record<string, string[]>>;
  medSupp: string[];
  medSuppCarriers: string[];
}
const CATALOG = catalog as Catalog;

// 2027 plan names by carrier (from Agent Compass's county plan lists).
export const PLAN_CATALOG: Record<string, string[]> = CATALOG.carriers;

export interface CarrierPlanOptions {
  carriers: string[];
  plansByCarrier: Record<string, string[]>;
  // Set when the list is narrowed to one county: that county's name, and
  // every county's plans for the "show all counties" switch.
  county?: string;
  allPlansByCarrier?: Record<string, string[]>;
}

// The 2027 plans sold in one county (plus Medicare Supplement plan letters,
// which aren't county-specific), or null if that county isn't in the list.
function countyCatalog(county: string | null | undefined): Record<string, string[]> | null {
  const plans = county ? CATALOG.counties[county] : undefined;
  if (!plans) return null;
  const out: Record<string, string[]> = {};
  for (const [c, list] of Object.entries(plans)) out[c] = [...list];
  for (const c of CATALOG.medSuppCarriers) out[c] = [...(out[c] ?? []), ...CATALOG.medSupp];
  return out;
}

// Choices for the Carrier and Plan Name boxes: the standard carriers plus any
// other carrier already used, and per carrier the catalog plans plus names
// already used (one entry per plan, catalog spelling first).
export function carrierPlanOptions(
  existing: { carrier: string; planName: string }[],
  county?: string | null
): CarrierPlanOptions {
  const plans = new Map<string, Map<string, string>>();
  const add = (carrier: string, plan: string) => {
    if (!plans.has(carrier)) plans.set(carrier, new Map());
    const m = plans.get(carrier)!;
    const k = looseKey(plan);
    if (k && !m.has(k)) m.set(k, plan.trim().replace(/\s+/g, " "));
  };
  for (const [carrier, list] of Object.entries(PLAN_CATALOG)) for (const p of list) add(carrier, p);
  for (const e of existing) add(canonicalCarrier(e.carrier), e.planName);
  const carriers = Array.from(new Set([...CARRIER_NAMES, ...plans.keys()])).sort((a, b) => a.localeCompare(b));
  const plansByCarrier: Record<string, string[]> = {};
  for (const [c, m] of plans) plansByCarrier[c] = [...m.values()].sort((a, b) => a.localeCompare(b));
  const local = countyCatalog(county);
  if (!local || !county) return { carriers, plansByCarrier };
  const localSorted: Record<string, string[]> = {};
  for (const [c, list] of Object.entries(local)) localSorted[c] = [...new Set(list)].sort((a, b) => a.localeCompare(b));
  return { carriers, plansByCarrier: localSorted, county, allPlansByCarrier: plansByCarrier };
}

// The plan list (from Agent Compass) spelling of a plan name when it's the
// same plan written differently: other case or punctuation, the carrier name
// repeated or left off, or the plan type missing. Otherwise the text as
// typed, with a doubled carrier name taken out.
export function canonicalPlanName(carrier: string, raw: string): string {
  const tidy = raw.trim().replace(/\s+/g, " ");
  const list = PLAN_CATALOG[canonicalCarrier(carrier)] ?? [];
  const exact = list.find((p) => looseKey(p) === looseKey(tidy));
  if (exact) return exact;
  // With the plan type, then without it; only when it points to one plan.
  for (const key of [planBody, planKey]) {
    const hits = list.filter((p) => key(p) === key(tidy));
    if (hits.length === 1) return hits[0];
  }
  return undoubleCarrier(tidy);
}

// "Blue Shield Blue Shield Inspire" -> "Blue Shield Inspire".
function undoubleCarrier(name: string): string {
  const k = looseKey(name);
  for (const w of CARRIER_WORDS) {
    if (!k.startsWith(`${w} ${w} `)) continue;
    // Drop the first copy: as many words as the carrier name has.
    const n = w.split(" ").length;
    return name.split(" ").slice(n).join(" ");
  }
  return name;
}
