const AUTH_URL = process.env.INTEGRITY_AUTH_URL!;
const CLIENT_ID = process.env.INTEGRITY_CLIENT_ID!;
const CLIENT_SECRET = process.env.INTEGRITY_CLIENT_SECRET!;
const AGENT_NPN = process.env.INTEGRITY_AGENT_NPN!;

// Base URL for data endpoints, per the "Base URL" shown on Integrity's
// API Reference page.
const API_BASE_URL =
  process.env.INTEGRITY_API_BASE_URL ??
  "https://ae-api.integrity.com/ae-partner-gateway-service";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

// Renew this many ms before actual expiry to avoid using a token that
// expires mid-request.
const EXPIRY_BUFFER_MS = 60_000;

async function fetchToken(): Promise<CachedToken> {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity auth failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  const data = await res.json();

  // NOTE: field names assumed from standard OAuth2 client_credentials
  // responses (access_token / expires_in). Confirm against Integrity's
  // actual response payload and adjust if their field names differ.
  const accessToken: string | undefined = data.access_token ?? data.accessToken;
  const expiresInSeconds: number = data.expires_in ?? data.expiresIn ?? 3600;

  if (!accessToken) {
    throw new Error(
      `Integrity auth response missing access token: ${JSON.stringify(data)}`
    );
  }

  return {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
}

export async function getIntegrityAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - EXPIRY_BUFFER_MS > Date.now()) {
    return cachedToken.accessToken;
  }

  cachedToken = await fetchToken();
  return cachedToken.accessToken;
}

/**
 * Fetch wrapper that attaches a valid Integrity bearer token.
 * `path` is joined against API_BASE_URL unless it's already an absolute URL.
 */
export async function integrityFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getIntegrityAccessToken();
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  return fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export interface IntegrityLead {
  leadId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  stage: number;
  stageName: string | null;
  createdDate: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  birthdate: string | null;
  medicareBeneficiaryId: string | null;
}

// Real production shape — confirmed against Integrity's production API
// (2026-08-31). Meaningfully different from the docs' example response
// (which only showed leadId/firstName/lastName/email/phone/stage/
// createdDate as flat fields): real leads nest emails/phones/addresses as
// arrays, use `leadsId` not `leadId`, and carry a real `statusName` instead
// of just a numeric code. Only the fields we use are typed here.
interface RawIntegrityLead {
  leadsId: number;
  firstName: string;
  lastName: string;
  leadStatusId: number;
  statusName: string | null;
  createDate: string;
  birthdate: string | null;
  medicareBeneficiaryId: string | null;
  emails: { leadEmail: string; inactive: boolean }[];
  phones: { leadPhone: string; inactive: boolean }[];
  addresses: {
    address1: string;
    address2: string | null;
    city: string;
    stateCode: string;
    postalCode: string;
  }[];
}

interface IntegrityLeadsResponse {
  result: RawIntegrityLead[];
  pageResult: {
    total: number;
    pageSize: number;
    totalPages: number;
  };
}

function firstActive<T extends { inactive: boolean }>(items: T[]): T | undefined {
  return items.find((i) => !i.inactive) ?? items[0];
}

function mapLead(raw: RawIntegrityLead): IntegrityLead {
  const email = firstActive(raw.emails ?? []);
  const phone = firstActive(raw.phones ?? []);
  const address = raw.addresses?.[0];

  return {
    leadId: raw.leadsId,
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: email?.leadEmail ?? null,
    phone: phone?.leadPhone ?? null,
    stage: raw.leadStatusId,
    stageName: raw.statusName,
    createdDate: raw.createDate,
    address1: address?.address1 ?? null,
    address2: address?.address2 ?? null,
    city: address?.city ?? null,
    stateCode: address?.stateCode ?? null,
    postalCode: address?.postalCode ?? null,
    birthdate: raw.birthdate,
    medicareBeneficiaryId: raw.medicareBeneficiaryId,
  };
}

export async function getIntegrityLeads(): Promise<IntegrityLead[]> {
  // NOTE: the page-offset parameter is unconfirmed as of 2026-08-31 (tried
  // page/Page/pageNumber/skip against production, none advanced past the
  // first page) — but pageSize itself IS honored, so we sidestep pagination
  // entirely by requesting a page large enough to cover every lead in one
  // call. Revisit if the account ever exceeds this.
  const res = await integrityFetch("/partners/leads?pageSize=5000");

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity leads fetch failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  const data: IntegrityLeadsResponse = await res.json();
  return data.result.map(mapLead);
}

export interface IntegrityLeadAddressInput {
  address1: string;
  address2?: string;
  city: string;
  stateCode: string;
  postalCode: string;
  county?: string;
  countyFips?: string;
}

export async function pushIntegrityLeadAddress(
  leadId: string | number,
  address: IntegrityLeadAddressInput
): Promise<unknown> {
  const res = await integrityFetch(`/partners/leads/${leadId}/addresses`, {
    method: "POST",
    body: JSON.stringify({
      agentNpn: AGENT_NPN,
      ...address,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity address push failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json().catch(() => null);
}

export async function pushIntegrityLeadEmail(
  leadId: string | number,
  email: string
): Promise<unknown> {
  const res = await integrityFetch(`/partners/leads/${leadId}/emails`, {
    method: "POST",
    body: JSON.stringify({ agentNpn: AGENT_NPN, email }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity email push failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json().catch(() => null);
}

export interface IntegrityPharmacyServices {
  has24HrService: boolean;
  hasCompounding: boolean;
  hasDelivery: boolean;
  hasDriveUp: boolean;
  hasDurableEquipment: boolean;
  hasEPrescriptions: boolean;
  hasHandicapAccess: boolean;
  isHomeInfusion: boolean;
  isLongTermCare: boolean;
}

export interface IntegrityPharmacySearchItem {
  pharmacyRecordId: number | null;
  pharmacyID: string;
  pharmacyNpi: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  distance: number;
  pharmacyPhone: string;
  latitude: number;
  longitude: number;
  pharmacyNABP: string | null;
  chain: string;
  isDigital: boolean;
  chainName: string | null;
  pharmacyServices: IntegrityPharmacyServices;
  pharmacyCoverage: unknown;
}

export interface IntegrityPharmacySearchParams {
  zip?: string;
  radius?: number;
  pharmacyName?: string;
  planPharmacyType?: string;
  latLng?: string;
  pharmacyIdType?: number;
  take?: number;
  skip?: number;
}

export async function searchIntegrityPharmacies(
  params: IntegrityPharmacySearchParams
): Promise<{ totalCount: number; radius: number; pharmacyList: IntegrityPharmacySearchItem[] }> {
  const query = new URLSearchParams();
  if (params.zip) query.set("Zip", params.zip);
  if (params.radius != null) query.set("Radius", String(params.radius));
  if (params.pharmacyName) query.set("PharmacyName", params.pharmacyName);
  if (params.planPharmacyType) query.set("PlanPharmacyType", params.planPharmacyType);
  if (params.latLng) query.set("LatLng", params.latLng);
  if (params.pharmacyIdType != null) query.set("PharmacyIdType", String(params.pharmacyIdType));
  if (params.take != null) query.set("Take", String(params.take));
  if (params.skip != null) query.set("Skip", String(params.skip));

  const res = await integrityFetch(`/partners/quotes/search/pharmacies?${query}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity pharmacy search failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json();
}

export interface IntegrityPharmacySaveRequest {
  pharmacyId: string;
  isMailOrder: boolean;
  isPrimary: boolean;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
  state: string;
  pharmacyPhone?: string;
  pharmacyIdType?: number;
  isDigital: boolean;
}

export async function saveIntegrityLeadPharmacies(
  leadId: string | number,
  pharmacies: IntegrityPharmacySaveRequest[]
): Promise<unknown> {
  const res = await integrityFetch(`/partners/quotes/leads/${leadId}/pharmacies`, {
    method: "POST",
    body: JSON.stringify(pharmacies),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity save pharmacies failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json().catch(() => null);
}

export async function pushIntegrityLeadPhone(
  leadId: string | number,
  phoneNumber: string
): Promise<unknown> {
  const res = await integrityFetch(`/partners/leads/${leadId}/phones`, {
    method: "POST",
    body: JSON.stringify({ agentNpn: AGENT_NPN, phoneNumber }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity phone push failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json().catch(() => null);
}

export interface IntegrityProviderAddress {
  id: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  phoneNumbers: string[];
  inNetwork: boolean;
}

export interface IntegrityProviderSearchItem {
  npi: number;
  email: string | null;
  gender: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  suffix: string | null;
  title: string | null;
  specialty: string | null;
  subspecialty: string | null;
  organizationName: string | null;
  presentationName: string;
  phone: string | null;
  isIndividual: boolean;
  type: string;
  addresses: IntegrityProviderAddress[];
}

export interface IntegrityProviderSearchParams {
  searchTerm?: string;
  radius?: number;
  zipCode?: string;
  npis?: string[];
  providerType?: "Individual" | "Organization";
  page?: number;
  perPage?: number;
}

export async function searchIntegrityProviders(
  params: IntegrityProviderSearchParams
): Promise<{ total: number; providers: IntegrityProviderSearchItem[] }> {
  const query = new URLSearchParams();
  if (params.searchTerm) query.set("SearchTerm", params.searchTerm);
  if (params.radius != null) query.set("Radius", String(params.radius));
  if (params.zipCode) query.set("ZipCode", params.zipCode);
  if (params.npis) for (const npi of params.npis) query.append("Npis", npi);
  if (params.providerType) query.set("ProviderType", params.providerType);
  if (params.page != null) query.set("Page", String(params.page));
  if (params.perPage != null) query.set("PerPage", String(params.perPage));

  const res = await integrityFetch(`/partners/quotes/search/providers?${query}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity provider search failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json();
}

export interface IntegrityProviderSaveRequest {
  npi?: string;
  addressId?: string;
  isPrimary: boolean;
  providerId?: string;
}

export async function saveIntegrityLeadProviders(
  leadId: string | number,
  providers: IntegrityProviderSaveRequest[]
): Promise<unknown> {
  const res = await integrityFetch(`/partners/quotes/leads/${leadId}/providers`, {
    method: "POST",
    body: JSON.stringify(providers),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity save providers failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json().catch(() => null);
}

// NOTE: dosages/genericDosages come back null for every drug in the
// sandbox account tested so far (no dosage catalog data populated).
// Shape is unconfirmed live; typed loosely until real data is available.
export interface IntegrityDrug {
  drugId: number;
  drugName: string;
  drugType: string;
  chemicalName: string;
  referenceNdc: string;
  genericDrugId: number;
  genericDrugName: string | null;
  genericChemicalName: string | null;
  dosages: unknown[] | null;
  genericDosages: unknown[] | null;
}

export async function searchIntegrityPrescriptions(params: {
  ndc?: string;
  drugName?: string;
}): Promise<IntegrityDrug[]> {
  const query = new URLSearchParams();
  if (params.ndc) query.set("ndc", params.ndc);
  if (params.drugName) query.set("drugName", params.drugName);

  const res = await integrityFetch(`/partners/quotes/search/prescriptions?${query}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity prescription search failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json();
}

export interface IntegrityPrescriptionSaveRequest {
  dosageRecordId?: number;
  dosageId: string;
  quantity: number;
  daysOfSupply: number;
  ndc: string;
  metricQuantity?: number;
}

export async function saveIntegrityLeadPrescriptions(
  leadId: string | number,
  prescriptions: IntegrityPrescriptionSaveRequest[]
): Promise<unknown> {
  const res = await integrityFetch(`/partners/quotes/leads/${leadId}/prescriptions`, {
    method: "POST",
    body: JSON.stringify(prescriptions),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Integrity save prescriptions failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  return res.json().catch(() => null);
}
