import zipCounty from "@/lib/zipCounty.json";

// California county FIPS codes Integrity sometimes sends instead of names.
const CA_FIPS: Record<string, string> = {
  "06037": "Los Angeles",
  "06059": "Orange",
  "06065": "Riverside",
  "06071": "San Bernardino",
  "06073": "San Diego",
  "06083": "Santa Barbara",
  "06097": "Sonoma",
  "06111": "Ventura",
};

const ZIP_COUNTY: Record<string, string> = (zipCounty as { counties: Record<string, string> }).counties;

// "Orange County", "06059" and "orange" all become "Orange". Blank -> null.
export function normalizeCounty(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^\d{5}$/.test(t)) return CA_FIPS[t] ?? null;
  const name = t.replace(/\s+county$/i, "").replace(/\s+/g, " ");
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

// The Southern California county a ZIP code is (mostly) in, if known.
export function countyForZip(zip: string | null | undefined): string | null {
  const z = (zip ?? "").trim().slice(0, 5);
  return /^\d{5}$/.test(z) ? ZIP_COUNTY[z] ?? null : null;
}

// Counties offered in the County box.
export const COUNTY_OPTIONS = ["Los Angeles", "Orange", "Riverside", "San Bernardino", "San Diego", "Ventura"];
