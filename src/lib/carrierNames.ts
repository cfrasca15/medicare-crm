// Carrier names and plan-name matching, without the plan catalog, so it
// can be used in the browser too. carriers.ts re-exports all of this.

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
    aliases: ["unitedhealthcare", "united healthcare", "united health care", "united", "uhc", "aarp", "aarp unitedhealthcare", "aarp uhc", "unitedhealthcare aarp"],
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

// Words that say which carrier a plan belongs to, longest first, so a plan
// name typed with the carrier in front ("Blue Shield Blue Shield Inspire")
// can be compared without it.
export const CARRIER_WORDS = [...aliasMap.keys()].sort((a, b) => b.length - a.length);

// Plan type tags that are often left off or written differently.
const TYPE_WORDS = /\b(hmo|ppo|pos|pffs|msa|snp|c snp|d snp|i snp|csnp|dsnp|isnp)\b/g;

// A plan name with any leading carrier names (and "Medicare Supplement")
// removed, keeping the plan type: "Blue Shield Blue Shield Inspire (HMO)"
// becomes "inspire hmo".
export function planBody(raw: string): string {
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

