import { NextRequest } from "next/server";
import { loadBook } from "@/lib/bookOfBusiness";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDateOnly } from "@/lib/date";

// The Book of Business page's rows (same filters) as a flat list.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rows = await loadBook({
    carrier: searchParams.get("carrier") || undefined,
    group: searchParams.get("group") || undefined,
    q: searchParams.get("q") || undefined,
  });

  const csv = toCsv(
    ["Client", "Phone", "Carrier", "Plan Name", "Plan Type", "Medical Group", "Doctor", "Current / Future", "Effective Date"],
    rows.map((r) => [
      r.name,
      r.phone ?? "",
      r.carrier,
      r.planName,
      r.planType ?? "",
      r.medicalGroup ?? "",
      r.doctor ?? "",
      r.status === "future" ? "Future" : "Current",
      r.effectiveDate ? formatDateOnly(r.effectiveDate) : "",
    ])
  );
  return csvResponse("book-of-business.csv", csv);
}
