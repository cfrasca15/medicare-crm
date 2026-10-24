import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS } from "@/lib/constants";
import { contactWhere } from "@/lib/contactFilters";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDateOnly } from "@/lib/date";
import { currentPolicy } from "@/lib/coverage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const where = contactWhere({
    stage: searchParams.get("stage"),
    q: searchParams.get("q"),
    source: searchParams.get("source"),
    flag: searchParams.get("flag"),
    county: searchParams.get("county"),
    eff: searchParams.get("eff"),
  });

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { lastName: "asc" },
    include: { policies: { select: { effectiveDate: true } } },
  });

  const csv = toCsv(
    [
      "Integrity Lead ID",
      "First Name",
      "Last Name",
      "Phone",
      "Cell Phone",
      "Preferred Phone",
      "Email",
      "Address",
      "City",
      "State",
      "ZIP",
      "County",
      "Mailing Address",
      "Mailing City",
      "Mailing State",
      "Mailing ZIP",
      "Date of Birth",
      "Insurance Company",
      "Plan Name",
      "Medicare ID",
      "Part A Effective",
      "Part B Effective",
      "Doctor",
      "Medical Group",
      "Stage",
      "Policy Effective",
      "Lead Source",
      "Medi-Cal",
      "Extra Help",
      "Contact Person",
      "Contact Person Relationship",
      "Contact Person Phone",
      "Contact Person Email",
      "Call Contact Person Instead",
    ],
    contacts.map((c) => [
      c.integrityContactId,
      c.firstName,
      c.lastName,
      c.phone,
      c.cellPhone ?? "",
      c.cellPhone && c.cellPreferred ? "Cell" : "",
      c.email,
      c.address,
      c.city,
      c.state,
      c.zip,
      c.county ?? "",
      c.hasMailingAddress ? c.mailingAddress ?? "" : "",
      c.hasMailingAddress ? c.mailingCity ?? "" : "",
      c.hasMailingAddress ? c.mailingState ?? "" : "",
      c.hasMailingAddress ? c.mailingZip ?? "" : "",
      c.dateOfBirth ? formatDateOnly(c.dateOfBirth) : "",
      c.insuranceCompany,
      c.planName,
      c.medicareId,
      c.partAEffectiveDate ? formatDateOnly(c.partAEffectiveDate) : "",
      c.partBEffectiveDate ? formatDateOnly(c.partBEffectiveDate) : "",
      c.doctor,
      c.medicalGroup,
      STAGE_LABELS[c.stage],
      (() => {
        const policy = currentPolicy(c.policies);
        return policy?.effectiveDate ? formatDateOnly(policy.effectiveDate) : "";
      })(),
      c.leadSource ?? "",
      c.medicaid ? "Yes" : "",
      c.extraHelp ? "Yes" : "",
      c.altContactName ?? "",
      c.altContactRelationship ?? "",
      c.altContactPhone ?? "",
      c.altContactEmail ?? "",
      c.altContactPreferred ? "Yes" : "",
    ])
  );

  return csvResponse("contacts.csv", csv);
}
