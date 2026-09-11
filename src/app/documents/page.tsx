import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { uploadPlanDocument, deletePlanDocument } from "@/lib/actions/documents";
import { CARRIER_SEED, DOC_TYPE_LABELS, DOC_TYPE_ORDER } from "@/lib/constants";
import { formatDateOnly } from "@/lib/date";

export const dynamic = "force-dynamic";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ carrier?: string; planName?: string }>;
}) {
  const { carrier: filterCarrier, planName: filterPlanName } = await searchParams;

  const [allDocs, carrierRows, planNameRows] = await Promise.all([
    prisma.planDocument.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.policy.findMany({ distinct: ["carrier"], select: { carrier: true } }),
    prisma.policy.findMany({ distinct: ["planName"], select: { planName: true } }),
  ]);

  const carrierOptions = Array.from(
    new Set([...CARRIER_SEED, ...carrierRows.map((r) => r.carrier)])
  ).sort();
  const planNameOptions = Array.from(new Set(planNameRows.map((r) => r.planName))).sort();

  const generalDocs = allDocs.filter((d) => !d.carrier);
  let planDocs = allDocs.filter((d) => d.carrier);

  const isFiltered = Boolean(filterCarrier);
  if (isFiltered) {
    planDocs = planDocs.filter(
      (d) =>
        d.carrier === filterCarrier &&
        (!filterPlanName || d.planName === filterPlanName)
    );
  }

  const grouped = new Map<string, typeof planDocs>();
  for (const doc of planDocs) {
    const key = `${doc.carrier}|||${doc.planName ?? ""}`;
    grouped.set(key, [...(grouped.get(key) ?? []), doc]);
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Plan Documents</h1>
        <p className="muted mt-1 text-sm">
          SOBs, EOCs, rate sheets, benefit highlights, and comparison
          spreadsheets in one place, organized by carrier and plan.
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
          <div />
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
        {isFiltered && (
          <p className="muted mb-3 text-sm">
            Showing {filterCarrier}
            {filterPlanName ? ` — ${filterPlanName}` : ""}
          </p>
        )}
        {grouped.size === 0 && (
          <p className="muted text-sm">No plan-specific documents yet.</p>
        )}
        <div className="flex flex-col gap-4">
          {Array.from(grouped.entries()).map(([key, docs]) => {
            const [carrier, planName] = key.split("|||");
            return (
              <div key={key}>
                <h3 className="mb-2 text-sm font-medium">
                  {carrier}
                  {planName && ` — ${planName}`}
                </h3>
                <div className="flex flex-col gap-2">
                  {docs.map((doc) => (
                    <DocRow key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>
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

function DocRow({
  doc,
}: {
  doc: {
    id: string;
    fileName: string;
    docType: string;
    fileSize: number;
    createdAt: Date;
  };
}) {
  const deleteBound = deletePlanDocument.bind(null, doc.id);
  return (
    <div className="surface flex items-center justify-between px-3 py-2 text-sm">
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
        <span className="muted text-xs">{formatFileSize(doc.fileSize)}</span>
        <span className="muted text-xs">{formatDateOnly(doc.createdAt)}</span>
        <form action={deleteBound}>
          <button type="submit" className="btn-danger-text text-xs">
            Remove
          </button>
        </form>
      </div>
    </div>
  );
}
