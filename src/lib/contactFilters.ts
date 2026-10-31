import { PipelineStage, Prisma } from "@/generated/prisma/client";
import { STAGE_ORDER } from "@/lib/constants";
import { monthRange } from "@/lib/date";

export interface ContactFilterParams {
  stage?: string | null;
  q?: string | null;
  source?: string | null; // "website", "none", or a lead source name
  flag?: string | null; // "medicaid", "extraHelp" or "either"
  county?: string | null;
  eff?: string | null; // yyyy-mm
}

// The Contacts page's filters as a database query; the CSV export uses the
// same so it always matches what's on screen.
export function contactWhere(p: ContactFilterParams): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [];
  if (p.stage && STAGE_ORDER.includes(p.stage)) and.push({ stage: p.stage as PipelineStage });
  if (p.source === "website") {
    and.push({ OR: [{ leadSource: { startsWith: "Website" } }, { lastWebsiteLeadAt: { not: null } }] });
  } else if (p.source === "none") {
    and.push({ leadSource: null, lastWebsiteLeadAt: null });
  } else if (p.source) {
    and.push({ leadSource: p.source });
  }
  if (p.flag === "medicaid") and.push({ medicaid: true });
  else if (p.flag === "extraHelp") and.push({ extraHelp: true });
  else if (p.flag === "either") and.push({ OR: [{ medicaid: true }, { extraHelp: true }] });
  if (p.county) and.push({ county: p.county });
  const effectiveRange = monthRange(p.eff);
  if (effectiveRange) and.push({ policies: { some: { effectiveDate: effectiveRange } } });
  if (p.q) {
    and.push({
      OR: [
        { firstName: { contains: p.q } },
        { lastName: { contains: p.q } },
        { email: { contains: p.q } },
        { phone: { contains: p.q } },
        { cellPhone: { contains: p.q } },
        { altContactName: { contains: p.q } },
        { altContactPhone: { contains: p.q } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}
