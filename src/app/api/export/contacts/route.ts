import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { PipelineStage, Prisma } from "@/generated/prisma/client";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDateOnly } from "@/lib/date";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const q = searchParams.get("q");

  const where: Prisma.ContactWhereInput = {};
  if (stage && STAGE_ORDER.includes(stage)) {
    where.stage = stage as PipelineStage;
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { lastName: "asc" },
  });

  const csv = toCsv(
    [
      "Integrity Lead ID",
      "First Name",
      "Last Name",
      "Phone",
      "Email",
      "Address",
      "City",
      "State",
      "ZIP",
      "Date of Birth",
      "Insurance Company",
      "Plan Name",
      "Medicare ID",
      "Part A Effective",
      "Part B Effective",
      "Doctor",
      "Medical Group",
      "Stage",
    ],
    contacts.map((c) => [
      c.integrityContactId,
      c.firstName,
      c.lastName,
      c.phone,
      c.email,
      c.address,
      c.city,
      c.state,
      c.zip,
      c.dateOfBirth ? formatDateOnly(c.dateOfBirth) : "",
      c.insuranceCompany,
      c.planName,
      c.medicareId,
      c.partAEffectiveDate ? formatDateOnly(c.partAEffectiveDate) : "",
      c.partBEffectiveDate ? formatDateOnly(c.partBEffectiveDate) : "",
      c.doctor,
      c.medicalGroup,
      STAGE_LABELS[c.stage],
    ])
  );

  return csvResponse("contacts.csv", csv);
}
