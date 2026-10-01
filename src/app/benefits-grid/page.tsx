import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { setDocumentEmbedUrl } from "@/lib/actions/documents";
import { toEmbeddableUrl } from "@/lib/embed";

export const dynamic = "force-dynamic";

export default async function BenefitsGridPage() {
  const docs = await prisma.planDocument.findMany({
    where: { docType: "COMPARISON_SPREADSHEET" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Benefits Grid</h1>
        <p className="muted mt-1 text-sm">
          Your comparison spreadsheet(s), live from Google Sheets — for your
          own reference, not client-facing.
        </p>
      </div>

      {docs.length === 0 && (
        <p className="muted text-sm">
          No comparison spreadsheet uploaded yet. Upload one from{" "}
          <Link href="/documents" className="link">
            Documents
          </Link>{" "}
          (leave Carrier blank, choose type &quot;Comparison Spreadsheet&quot;), then
          come back here to link it to a live Google Sheet.
        </p>
      )}

      {docs.map((doc) => {
        const embedBound = setDocumentEmbedUrl.bind(null, doc.id);
        return (
          <div key={doc.id} className="surface flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {doc.fileName}
                {doc.planYear && <span className="muted ml-2 font-normal">({doc.planYear})</span>}
              </h2>
              <a
                href={`/api/documents/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link text-xs"
              >
                Download original file
              </a>
            </div>

            <form action={embedBound} className="flex items-center gap-2">
              <input
                type="url"
                name="embedUrl"
                defaultValue={doc.embedUrl ?? ""}
                placeholder="Paste a Google Sheets / Docs / Drive share link"
                className="field flex-1 text-sm"
              />
              <button type="submit" className="btn-secondary text-sm">
                {doc.embedUrl ? "Update link" : "Save link"}
              </button>
            </form>

            {doc.embedUrl ? (
              <iframe
                src={toEmbeddableUrl(doc.embedUrl)}
                className="h-[80vh] w-full rounded border border-slate-200 dark:border-slate-800"
              />
            ) : (
              <p className="muted text-sm">
                No live link yet. In Google Drive, open this file with Google
                Sheets, then paste its share link above.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
