// Reads website leads from the dedicated Airtable "leads" base and removes them
// once the CRM has imported them. The CRM only makes outbound calls here;
// nothing from the website is ever pushed into it.
//
// Env (docker.env / .env.local):
//   WEBSITE_LEADS_AIRTABLE_TOKEN   token scoped to ONLY the leads base
//   WEBSITE_LEADS_BASE_ID          the leads base ID (starts with "app...")
//   WEBSITE_LEADS_TABLE            optional, defaults to "Leads"

export interface WebsiteLead {
  recordId: string;
  submittedAt: string;
  source: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  detail: string;
  consent: string;
}

function config() {
  const token = process.env.WEBSITE_LEADS_AIRTABLE_TOKEN;
  const baseId = process.env.WEBSITE_LEADS_BASE_ID;
  const table = process.env.WEBSITE_LEADS_TABLE || "Leads";
  if (!token || !baseId) {
    throw new Error(
      "Website leads aren't configured. Set WEBSITE_LEADS_AIRTABLE_TOKEN and WEBSITE_LEADS_BASE_ID."
    );
  }
  return { token, baseUrl: `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}` };
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export async function listWebsiteLeads(): Promise<WebsiteLead[]> {
  const { token, baseUrl } = config();
  const leads: WebsiteLead[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    params.set("sort[0][field]", "Submitted At");
    params.set("sort[0][direction]", "asc");
    if (offset) params.set("offset", offset);

    const res = await fetch(`${baseUrl}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Airtable leads fetch failed: ${res.status} ${body}`);
    }
    const data = (await res.json()) as {
      records?: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };

    for (const r of data.records ?? []) {
      const f = r.fields;
      leads.push({
        recordId: r.id,
        submittedAt: str(f["Submitted At"]),
        source: str(f["Source"]),
        firstName: str(f["First Name"]),
        lastName: str(f["Last Name"]),
        phone: str(f["Phone"]),
        email: str(f["Email"]),
        detail: str(f["Detail"]),
        consent: str(f["Consent"]),
      });
    }
    offset = data.offset;
  } while (offset);

  return leads;
}

/** Removes an imported lead from Airtable so contact details don't pile up there. */
export async function deleteWebsiteLead(recordId: string): Promise<boolean> {
  const { token, baseUrl } = config();
  const res = await fetch(`${baseUrl}/${encodeURIComponent(recordId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}
