import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  uploadPlanDocument,
  deletePlanDocument,
  setDocumentEmbedUrl,
} from "@/lib/actions/documents";
import { CARRIER_SEED, COUNTY_SEED, DOC_TYPE_LABELS, DOC_TYPE_ORDER } from "@/lib/constants";
import { formatDateOnly } from "@/lib/date";
import { toEmbeddableUrl } from "@/lib/embed";

export const dynamic = "force-dynamic";

const NO_COUNTY = "\u0000no-county";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Doc = {
  id: string;
  fileName: string;
  docType: string;
  fileSize: number;
  createdAt: Date;
  carrier: string | null;
  county: string | null;
  planYear: number | null;
  planName: string | null;
  embedUrl: string | null;
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ carrier?: string; county?: string; planName?: string }>;
}) {
  const { carrier: filterCarrier, county: filterCounty, planName: filterPlanName } =
    await searchParams;

  const [allDocs, carrierRows, planNameRows] = await Promise.all([
    prisma.planDocument.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.policy.findMany({ distinct: ["carrier"], select: { carrier: true } }),
    prisma.policy.findMany({ distinct: ["planName"], select: { planName: true } }),
  ]);

  const carrierOptions = Array.from(
    new Set([...CARRIER_SEED, ...carrierRows.map((r) => r.carrier)])
  ).sort();
  const countyOptions = Array.from(
    new Set([...COUNTY_SEED, ...allDocs.flatMap((d) => (d.county ? [d.county] : []))])
  ).sort();
  const planNameOptions = Array.from(new Set(planNameRows.map((r) => r.planName))).sort();

  const generalDocs = allDocs.filter((d) => !d.carrier);
  let planDocs = allDocs.filter((d) => d.carrier);

  const isFiltered = Boolean(filterCarrier || filterCounty || filterPlanName);
  if (filterCarrier) planDocs = planDocs.filter((d) => d.carrier === filterCarrier);
  if (filterCounty) planDocs = planDocs.filter((d) => (d.county ?? "") === filterCounty);
  if (filterPlanName) planDocs = planDocs.filter((d) => d.planName === filterPlanName);

  // Carrier -> County -> Plan name -> docs, folder-style, for the "file
  // system" feel — mirrors how these documents are actually sourced (one
  // carrier's site, one county's plan list, one plan's document set).
  const byCarrier = new Map<string, Map<string, Map<string, Doc[]>>>();
  for (const doc of planDocs) {
    const carrier = doc.carrier!;
    const county = doc.county ?? NO_COUNTY;
    const plan = doc.planName ?? "";
    if (!byCarrier.has(carrier)) byCarrier.set(carrier, new Map());
    const byCounty = byCarrier.get(carrier)!;
    if (!byCounty.has(county)) byCounty.set(county, new Map());
    const byPlan = byCounty.get(county)!;
    byPlan.set(plan, [...(byPlan.get(plan) ?? []), doc]);
  }
  const carrierGroups = Array.from(byCarrier.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Plan Documents</h1>
        <p className="muted mt-1 text-sm">
          SOBs, EOCs, ANOCs, benefit highlights, and comparison spreadsheets in
          one place, organized by carrier, county, and plan.
        </p>
      </div>

      <details className="surface p-3">
        <summary className="cursor-pointer text-sm font-medium">+ Upload Document</summary>
        <form
          action={uploadPlanDocument}
          encType="multipart/form-data"
          className="mt-3 grid grid-cols-2 gap-3"
        >
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="file">
              File <span className="text-red-500">*</span>
            </label>
            <input id="file" name="file" type="file" required className="field" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="docType">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select id="docType" name="docType" required defaultValue="" className="field">
              <option value="" disabled>
                Choose type…
              </option>
              {DOC_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="planYear">
              Plan Year
            </label>
            <input
              id="planYear"
              name="planYear"
              type="number"
              placeholder="2027"
              className="field"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="carrier">
              Carrier
            </label>
            <input
              id="carrier"
              name="carrier"
              list="doc-carrier-options"
              autoComplete="off"
              placeholder="Leave blank for general documents"
              className="field"
            />
            <datalist id="doc-carrier-options">
              {carrierOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="county">
              County
            </label>
            <input
              id="county"
              name="county"
              list="doc-county-options"
              autoComplete="off"
              className="field"
            />
            <datalist id="doc-county-options">
              {countyOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="planName">
              Plan Name
            </label>
            <input
              id="planName"
              name="planName"
              list="doc-plan-name-options"
              autoComplete="off"
              className="field"
            />
            <datalist id="doc-plan-name-options">
              {planNameOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2">
            <button type="submit" className="btn-primary">
              Upload
            </button>
          </div>
        </form>
      </details>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-label">By Plan</h2>
          {isFiltered && (
            <Link href="/documents" className="link text-sm">
              Clear filter
            </Link>
          )}
        </div>

        <form className="surface mb-4 flex flex-wrap items-end gap-3 p-3 text-sm" action="/documents">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="filter-carrier">
              Carrier
            </label>
            <select
              id="filter-carrier"
              name="carrier"
              defaultValue={filterCarrier ?? ""}
              className="field"
            >
              <option value="">All carriers</option>
              {carrierOptions.map((carrier) => (
                <option key={carrier} value={carrier}>
                  {carrier}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="filter-county">
              County
            </label>
            <select
              id="filter-county"
              name="county"
              defaultValue={filterCounty ?? ""}
              className="field"
            >
              <option value="">All counties</option>
              {countyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Filter
          </button>
        </form>

        {carrierGroups.length === 0 && (
          <p className="muted text-sm">No plan-specific documents yet.</p>
        )}

        <div className="flex flex-col gap-2">
          {carrierGroups.map(([carrier, byCounty]) => {
            const countyGroups = Array.from(byCounty.entries()).sort((a, b) =>
              a[0].localeCompare(b[0])
            );
            const carrierDocCount = countyGroups.reduce(
              (sum, [, byPlan]) =>
                sum + Array.from(byPlan.values()).reduce((s, docs) => s + docs.length, 0),
              0
            );
            return (
              <details key={carrier} open={isFiltered} className="surface p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {carrier}{" "}
                  <span className="muted text-xs font-normal">
                    ({carrierDocCount} {carrierDocCount === 1 ? "document" : "documents"})
                  </span>
                </summary>
                <div className="mt-3 flex flex-col gap-3 pl-3">
                  {countyGroups.map(([county, byPlan]) => {
                    const planGroups = Array.from(byPlan.entries()).sort((a, b) =>
                      a[0].localeCompare(b[0])
                    );
                    return (
                      <details
                        key={county}
                        open={isFiltered}
                        className="border-l border-slate-200 pl-3 dark:border-slate-800"
                      >
                        <summary className="cursor-pointer text-sm font-medium">
                          {county === NO_COUNTY ? "No county set" : county}
                        </summary>
                        <div className="mt-2 flex flex-col gap-3 pl-3">
                          {planGroups.map(([plan, docs]) => (
                            <div key={plan || "—"}>
                              {plan && <h4 className="mb-1 text-sm">{plan}</h4>}
                              <div className="flex flex-col gap-2">
                                {sortByDocType(docs).map((doc) => (
                                  <DocRow key={doc.id} doc={doc} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-label mb-3">General</h2>
        {generalDocs.length === 0 && (
          <p className="muted text-sm">
            No general documents yet — upload your plan comparison spreadsheet
            here by leaving Carrier blank.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {generalDocs.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
        </div>
      </section>
    </div>
  );
}

function sortByDocType(docs: Doc[]): Doc[] {
  return [...docs].sort(
    (a, b) => DOC_TYPE_ORDER.indexOf(a.docType) - DOC_TYPE_ORDER.indexOf(b.docType)
  );
}

function DocRow({ doc }: { doc: Doc }) {
  const deleteBound = deletePlanDocument.bind(null, doc.id);
  const embedBound = setDocumentEmbedUrl.bind(null, doc.id);
  return (
    <div className="surface flex flex-col gap-2 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <a
          href={`/api/documents/${doc.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="link font-medium"
        >
          {doc.fileName}
        </a>
        <div className="flex items-center gap-3">
          <span className="muted text-xs">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</span>
          {doc.planYear && <span className="muted text-xs">{doc.planYear}</span>}
          <span className="muted text-xs">{formatFileSize(doc.fileSize)}</span>
          <span className="muted text-xs">{formatDateOnly(doc.createdAt)}</span>
          <form action={deleteBound}>
            <button type="submit" className="btn-danger-text text-xs">
              Remove
            </button>
          </form>
        </div>
      </div>

      {doc.embedUrl ? (
        <details>
          <summary className="muted cursor-pointer text-xs">
            Preview inline (Google Sheets)
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <iframe
              src={toEmbeddableUrl(doc.embedUrl)}
              className="h-[480px] w-full rounded border border-slate-200 dark:border-slate-800"
            />
            <form action={embedBound} className="flex items-center gap-2">
              <input
                type="url"
                name="embedUrl"
                defaultValue={doc.embedUrl}
                placeholder="Google Sheets / Docs / Drive share link"
                className="field flex-1 text-xs"
              />
              <button type="submit" className="btn-secondary text-xs">
                Update link
              </button>
            </form>
          </div>
        </details>
      ) : (
        <details>
          <summary className="muted cursor-pointer text-xs">+ Add inline preview link</summary>
          <form action={embedBound} className="mt-2 flex items-center gap-2">
            <input
              type="url"
              name="embedUrl"
              placeholder="Paste a Google Sheets / Docs / Drive share link"
              className="field flex-1 text-xs"
            />
            <button type="submit" className="btn-secondary text-xs">
              Save
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
