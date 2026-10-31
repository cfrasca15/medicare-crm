// Integrity's lead source codes as readable names. Codes that only say how
// the lead was entered (by hand, bulk upload, import) aren't a source.
const NAMES: Record<string, string | null> = {
  connecture: "Connecture",
  "cross sell": "Cross-Sell",
  switcher: "Switcher",
  "profile sync": "Profile Sync",
  purl: "PURL",
  planenroll: "PlanEnroll",
  leadcenter: "Lead Center",
  manual: null,
  bulkupload: null,
  import: null,
};

export function integrityLeadSource(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return null; // an id, not a name
  const key = t.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
  if (key in NAMES) return NAMES[key];
  const shopper = key.match(/^shopper\s*(\d{4})$/);
  if (shopper) return `Shopper ${shopper[1]}`;
  return t;
}

export const isWebsiteSource = (s: string | null | undefined) => !!s && s.startsWith("Website");

// The usual answers to "where did this lead come from?" Anything else can be
// typed in, and it's then suggested for other contacts.
export const LEAD_SOURCES = ["Providence Phone Call", "Event", "Website", "Ad", "Referral"];
