import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDateOnly } from "@/lib/date";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  const where: Prisma.PolicyWhereInput = {};
  if (year) {
    const y = Number(year);
    where.effectiveDate = {
      gte: new Date(Date.UTC(y, 0, 1)),
      lt: new Date(Date.UTC(y + 1, 0, 1)),
    };
  }

  const policies = await prisma.policy.findMany({
    where,
    include: { contact: true },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });

  const csv = toCsv(
    [
      "Client First Name",
      "Client Last Name",
      "Client Phone",
      "Client Email",
      "Carrier",
      "Plan Name",
      "Plan Type",
      "Policy Number",
      "Effective Date",
      "Term Date",
      "Doctor",
      "Medical Group",
      "Commission Status",
      "Commission Amount",
      "Annual Premium",
    ],
    policies.map((p) => [
      p.contact.firstName,
      p.contact.lastName,
      p.contact.phone,
      p.contact.email,
      p.carrier,
      p.planName,
      p.planType,
      p.policyNumber,
      p.effectiveDate ? formatDateOnly(p.effectiveDate) : "",
      p.termDate ? formatDateOnly(p.termDate) : "",
      p.doctor,
      p.medicalGroup,
      p.commissionStatus,
      p.commissionAmount,
      p.annualPremium,
    ])
  );

  return csvResponse("enrollments.csv", csv);
}
