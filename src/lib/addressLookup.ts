import { countyForZip, normalizeCounty } from "@/lib/county";

// Address autofill for the contact forms. With GOOGLE_PLACES_API_KEY set it
// uses Google Places (best house-number coverage); without one, or if Google
// fails, it falls back to Photon, a free OpenStreetMap search that needs no
// key. The key never leaves the server: the browser only talks to
// /api/address.

export type Address = {
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string; // "" when unknown; the save then fills it from the ZIP
};

export type Suggestion = {
  label: string;
  detail: string;
  // Google suggestions need a second lookup for the address parts; Photon's
  // come with them.
  placeId?: string;
  address?: Address;
};

export type Provider = "google" | "photon";

// GOOGLE_PLACES_API_BASE_URL overrides the API address (for a test server).
const GOOGLE_BASE = process.env.GOOGLE_PLACES_API_BASE_URL || "https://places.googleapis.com/v1";
const PHOTON_URL = "https://photon.komoot.io/api/";
const TIMEOUT_MS = 5000;

function googleKey(): string {
  return (process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
}

export async function suggestAddresses(
  query: string,
  sessionToken: string
): Promise<{ provider: Provider; suggestions: Suggestion[] }> {
  if (googleKey()) {
    try {
      return { provider: "google", suggestions: await googleSuggest(query, sessionToken) };
    } catch (err) {
      console.error("Address autofill: Google Places failed, using Photon instead:", err);
    }
  }
  return { provider: "photon", suggestions: await photonSuggest(query) };
}

export async function addressForPlace(placeId: string, sessionToken: string): Promise<Address> {
  if (!googleKey()) throw new Error("GOOGLE_PLACES_API_KEY isn't set.");
  const url = `${GOOGLE_BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, {
    headers: { "X-Goog-Api-Key": googleKey(), "X-Goog-FieldMask": "addressComponents" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Place Details ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { addressComponents?: GoogleComponent[] };
  return fromGoogleComponents(data.addressComponents ?? []);
}

// ---- Google Places (New) ----

type GoogleComponent = { longText?: string; shortText?: string; types?: string[] };

async function googleSuggest(query: string, sessionToken: string): Promise<Suggestion[]> {
  const res = await fetch(`${GOOGLE_BASE}/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey() },
    body: JSON.stringify({
      input: query,
      sessionToken,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Autocomplete ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .map((p) => ({
      placeId: p.placeId,
      label: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      detail: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

function fromGoogleComponents(parts: GoogleComponent[]): Address {
  const get = (type: string, short = false) => {
    const c = parts.find((p) => p.types?.includes(type));
    return ((short ? c?.shortText : c?.longText) ?? "").trim();
  };
  const unit = get("subpremise");
  const street = [get("street_number"), get("route", true)].filter(Boolean).join(" ") + (unit ? ` #${unit}` : "");
  const city = get("locality") || get("postal_town") || get("sublocality_level_1") || get("neighborhood");
  const zip = get("postal_code");
  return {
    street,
    city,
    state: get("administrative_area_level_1", true),
    zip,
    county: pickCounty(get("administrative_area_level_2"), zip),
  };
}

// ---- Photon (OpenStreetMap), the no-key fallback ----

type PhotonFeature = {
  properties: {
    countrycode?: string;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    locality?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
};

async function photonSuggest(query: string): Promise<Suggestion[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  url.searchParams.set("lang", "en");
  url.searchParams.append("layer", "house");
  url.searchParams.append("layer", "street");
  const res = await fetch(url, {
    headers: { "User-Agent": "medicare-crm address autofill" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const data = (await res.json()) as { features?: PhotonFeature[] };

  // A street without the typed house number: keep the number from the query
  // ("123 Main" -> "123 Main St"), since OpenStreetMap lacks many houses.
  const typedNumber = query.trim().match(/^(\d+[A-Za-z]?)\s/)?.[1] ?? "";
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties;
    if (p.countrycode !== "US") continue;
    const road = p.street ?? (p.type === "street" ? p.name : undefined);
    if (!road) continue;
    const number = p.housenumber ?? typedNumber;
    const zip = (p.postcode ?? "").slice(0, 5);
    const address: Address = {
      street: [number, road].filter(Boolean).join(" "),
      city: p.city ?? p.locality ?? p.district ?? "",
      state: stateCode(p.state ?? ""),
      zip,
      county: pickCounty(p.county ?? "", zip),
    };
    const detail = [address.city, [address.state, address.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const key = `${address.street}|${detail}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: address.street, detail, address });
    if (out.length === 5) break;
  }
  return out;
}

// ---- shared ----

// The provider's county, else the one the CRM knows for the ZIP.
function pickCounty(raw: string, zip: string): string {
  return normalizeCounty(raw) ?? countyForZip(zip) ?? "";
}

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "puerto rico": "PR",
};

function stateCode(name: string): string {
  const t = name.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATES[t.toLowerCase()] ?? t;
}
