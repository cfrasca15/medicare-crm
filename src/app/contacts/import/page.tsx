import Link from "next/link";
import { ContactImportForm } from "@/components/ContactImportForm";

export default function ContactImportPage() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/contacts" className="link text-sm">
            ← All contacts
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Import Contacts from CSV</h1>
          <p className="muted mt-1 text-sm">
            Upload a spreadsheet to bulk-update contact details, review the
            changes, then apply them — updates that Integrity supports get
            pushed there too.
          </p>
        </div>
        <Link href="/contacts/import/history" className="btn-secondary shrink-0">
          Import History
        </Link>
      </div>

      <ContactImportForm />
    </div>
  );
}
