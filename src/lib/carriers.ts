import catalog from "@/lib/planCatalog.json";

// One spelling per carrier. Plans typed with any of the listed aliases are
// saved under the carrier's name, so "UHC", "AARP" and "United Healthcare"
// all become "UnitedHealthcare".
export const CARRIERS: { name: string; aliases: string[] }[] = [
  { name: "Aetna", aliases: ["aetna", "aetna medicare", "cvs aetna"] },
  { name: "Alignment", aliases: ["alignment", "alignment health", "alignment healthcare", "alignment health plan"] },
  { name: "Anthem", aliases: ["anthem", "anthem blue cross", "anthem bc", "anthem blue cross of california"] },
  { name: "Astiva", aliases: ["astiva", "astiva health"] },
  { name: "Blue Shield", aliases: ["blue shield", "blue shield of ca", "blue shield of california", "bsc"] },
  { name: "CalOptima", aliases: ["caloptima", "caloptima health"] },
  { name: "Clever Care", aliases: ["clever care", "clever care health plan"] },
  { name: "Humana", aliases: ["humana", "humana inc"] },
  { name: "Imperial", aliases: ["imperial", "imperial health plan", "imperial health plan of california"] },
  { name: "Kaiser Permanente", aliases: ["kaiser", "kaiser permanente", "kp"] },
  { name: "Mutual of Omaha", aliases: ["mutual of omaha", "mutual omaha", "moo"] },
  { name: "Providence Health Plan", aliases: ["providence", "providence health plan"] },
  { name: "SCAN", aliases: ["scan", "scan health plan"] },
  { name: "Sharp Health Plan", aliases: ["sharp", "sharp health plan"] },
  { name: "UCLA Health", aliases: ["ucla", "ucla health", "ucla health medicare advantage"] },
  {
    name: "UnitedHealthcare",
    aliases: ["unitedhealthcare", "united healthcare", "united health care", "united", "uhc", "aarp", "aarp unitedhealthcare", "aarp uhc"],
  },
  { name: "Wellcare", aliases: ["wellcare", "well care", "wellcare by health net", "health net"] },
];

export const CARRIER_NAMES = CARRIERS.map((c) => c.name);

// Lowercase, "&" as "and", punctuation dropped, single spaces.
export const looseKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const aliasMap = new Map<string, string>();
for (const c of CARRIERS) for (const a of [c.name, ...c.aliases]) aliasMap.set(looseKey(a), c.name);

// The standard spelling for a carrier, or the text as typed (tidied) if it
// isn't one we know.
export function canonicalCarrier(raw: string): string {
  const tidy = raw.trim().replace(/\s+/g, " ");
  return aliasMap.get(looseKey(tidy)) ?? tidy;
}

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

// Words that say which carrier a plan belongs to, longest first, so a plan
// name typed with the carrier in front ("Blue Shield Blue Shield Inspire")
// can be compared without it.
const CARRIER_WORDS = [...aliasMap.keys()].sort((a, b) => b.length - a.length);

// Plan type tags that are often left off or written differently.
const TYPE_WORDS = /\b(hmo|ppo|pos|pffs|msa|snp|c snp|d snp|i snp|csnp|dsnp|isnp)\b/g;

// A plan name with any leading carrier names (and "Medicare Supplement")
// removed, keeping the plan type: "Blue Shield Blue Shield Inspire (HMO)"
// becomes "inspire hmo".
function planBody(raw: string): string {
  let k = looseKey(raw);
  for (let again = true; again; ) {
    again = false;
    for (const w of [...CARRIER_WORDS, "medicare supplement", "supplement", "med supp", "medigap"]) {
      if (k.startsWith(`${w} `)) {
        k = k.slice(w.length + 1);
        again = true;
        break;
      }
    }
  }
  return k;
}

// The name used to tell plans apart: no carrier names, no plan type and no
// trailing "plan", so "Inspire", "Blue Shield Inspire" and "Blue Shield
// Inspire (HMO)" all give "inspire".
export function planKey(raw: string): string {
  return planBody(raw).replace(TYPE_WORDS, " ").replace(/\bplan$/, "").replace(/\s+/g, " ").trim() || looseKey(raw);
}

// True when two plan names are the same plan written differently.
export const samePlan = (a: string, b: string) => planKey(a) === planKey(b);

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
