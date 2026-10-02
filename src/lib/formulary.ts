export const LIMIT_FLAGS: Record<string, string> = {
  PA: "Prior authorization required",
  ST: "Step therapy applies",
  QL: "Quantity limit",
  "B vs D": "Part B vs Part D determination",
  LD: "Limited distribution (specific pharmacies)",
  "B/D": "Part B vs Part D determination",
  BD: "Part B vs Part D determination",
  EDS: "Extended day supply available at mail order / many retail pharmacies",
  MO: "Available through mail-order delivery",
  ACS: "Available at CVS Specialty Pharmacy",
  HRM: "High-risk medication (older adults)",
  LA: "Limited access (specific pharmacies)",
  NDS: "Long-term (100-day) supply not available",
  NEDS: "Extended day supply not available",
  DL: "Dispensing limit (1-month supply per fill)",
  MME: "Opioid cumulative dose limit (morphine milligram equivalent)",
  "7D": "Opioid 7-day supply limit for new users",
  BvsD: "Part B vs Part D determination",
  BvD: "Part B vs Part D determination",
  AV: "ACIP-recommended vaccine, may be $0",
  CI: "Covered insulin product",
};

// Informational codes that aren't coverage restrictions — hidden from chips.
export const INFO_ONLY_CODES = new Set(["EDS", "MO", "NDS", "NEDS", "DL", "AV", "CI"]);

// Pulls the short restriction codes out of a raw "Requirements/Limits" string
// such as "PA; QL (30 EA per 30 days); EDS", keeping any detail in parentheses.
export function parseLimits(raw: string): { code: string; detail?: string }[] {
  const out: { code: string; detail?: string }[] = [];
  const re = /(?<![A-Za-z])(B vs D|BvsD|BvD|B\/D|BD|PA|ST|QL|LD|DL|EDS|NEDS|NDS|MO|ACS|HRM|LA|MME|7D|AV|CI)(?![A-Za-z])\s*(\([^)]*\))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push({ code: m[1], detail: m[2]?.slice(1, -1) });
  }
  return out;
}

export function splitDrugQuery(q: string): string[] {
  const terms = q
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return Array.from(new Set(terms.map((t) => t.toLowerCase()))).slice(0, 25);
}
