// 2027 commission amounts for the Add Policy form's Commission Amount list.
// Copied from the carriers' 2027 commission schedules (the Commissions page in
// Agent Compass, sourced from the PDFs in Drive > Medicare 2027 > Commission
// Shedules). Percentage and per-month schedules (most Medicare
// Supplement plans) aren't listed: enter those with "Other amount".
// Update these when a carrier publishes new rates.

export interface CommissionRate {
  // Matched against the Carrier box, lowercased.
  carrierKeys: string[];
  carrier: string;
  label: string;
  amount: number;
}

export const COMMISSION_RATES: CommissionRate[] = [
  { carrierKeys: ["anthem"], carrier: "Anthem", label: "MAPD SNP, new enrollment", amount: 902 },
  { carrierKeys: ["anthem"], carrier: "Anthem", label: "MAPD SNP, renewal", amount: 451 },
  { carrierKeys: ["anthem"], carrier: "Anthem", label: "MAPD non-SNP, new enrollment", amount: 864 },
  { carrierKeys: ["anthem"], carrier: "Anthem", label: "MAPD non-SNP, renewal", amount: 432 },
  { carrierKeys: ["anthem"], carrier: "Anthem", label: "Med Supp 65+, year 1 (open enrollment / underwritten)", amount: 720 },
  { carrierKeys: ["anthem"], carrier: "Anthem", label: "Med Supp 65+, year 1 (guaranteed issue)", amount: 240 },
  { carrierKeys: ["humana"], carrier: "Humana", label: "MAPD, new enrollment", amount: 902 },
  { carrierKeys: ["humana"], carrier: "Humana", label: "MAPD, renewal", amount: 451 },
  { carrierKeys: ["humana"], carrier: "Humana", label: "PDP, new enrollment", amount: 0 },
  { carrierKeys: ["scan"], carrier: "SCAN", label: "MAPD, new enrollment", amount: 902 },
  { carrierKeys: ["scan"], carrier: "SCAN", label: "MAPD, renewal", amount: 451 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "UnitedHealthcare", label: "MAPD SNP, new enrollment", amount: 902 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "UnitedHealthcare", label: "MAPD SNP, renewal", amount: 451 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "UnitedHealthcare", label: "MAPD non-SNP HMO, new enrollment", amount: 870 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "UnitedHealthcare", label: "MAPD non-SNP HMO, renewal", amount: 435 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "UnitedHealthcare", label: "MAPD non-SNP PPO, new enrollment", amount: 510 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "UnitedHealthcare", label: "MAPD non-SNP PPO, renewal after a UHC plan change", amount: 390 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "UnitedHealthcare", label: "MAPD non-SNP PPO, renewal (other)", amount: 255 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "UnitedHealthcare", label: "PDP", amount: 0 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "AARP", label: "Med Supp 65+ plans B, C, F, G, year 1", amount: 405 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "AARP", label: "Med Supp 65+ plan N, year 1", amount: 324 },
  { carrierKeys: ["united", "uhc", "aarp"], carrier: "AARP", label: "Med Supp 65+ plans A, K, L, year 1", amount: 162 },
];

// For carriers without a loaded schedule: the 2027 CMS maximum for California.
export const STANDARD_MAPD_RATES: { label: string; amount: number }[] = [
  { label: "MAPD, new enrollment (2027 CMS maximum, check carrier schedule)", amount: 902 },
  { label: "MAPD, renewal (2027 CMS maximum, check carrier schedule)", amount: 451 },
];

export function ratesForCarrier(carrier: string): { label: string; amount: number }[] {
  const c = carrier.trim().toLowerCase();
  if (!c) return [];
  const own = COMMISSION_RATES.filter((r) => r.carrierKeys.some((k) => c.includes(k)));
  return own.length ? own.map((r) => ({ label: `${r.carrier} ${r.label}`, amount: r.amount })) : STANDARD_MAPD_RATES;
}
