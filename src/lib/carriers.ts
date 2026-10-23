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

// 2027 plan names by carrier (from Agent Compass's county plan lists).
export const PLAN_CATALOG: Record<string, string[]> = (catalog as { carriers: Record<string, string[]> }).carriers;

export interface CarrierPlanOptions {
  carriers: string[];
  plansByCarrier: Record<string, string[]>;
}

// Choices for the Carrier and Plan Name boxes: the standard carriers plus any
// other carrier already used, and per carrier the catalog plans plus names
// already used (one entry per plan, catalog spelling first).
export function carrierPlanOptions(existing: { carrier: string; planName: string }[]): CarrierPlanOptions {
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
  return { carriers, plansByCarrier };
}

// The catalog's spelling of a plan name when it's the same plan typed
// differently (case, spacing, punctuation); otherwise the text as typed.
export function canonicalPlanName(carrier: string, raw: string): string {
  const tidy = raw.trim().replace(/\s+/g, " ");
  const key = looseKey(tidy);
  const hit = (PLAN_CATALOG[canonicalCarrier(carrier)] ?? []).find((p) => looseKey(p) === key);
  return hit ?? tidy;
}
