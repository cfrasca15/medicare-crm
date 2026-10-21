import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { saveStageMappings } from "@/lib/actions/stageMappings";
import { ReapplyMappingsButton } from "@/components/ReapplyMappingsButton";
import { SaveForm } from "@/components/SaveForm";

export const dynamic = "force-dynamic";

export default async function IntegrityStagesPage() {
  const [mappings, totals, atNewLead] = await Promise.all([
    prisma.integrityStageMapping.findMany({ orderBy: { code: "asc" } }),
    prisma.contact.groupBy({ by: ["integrityLeadStage"], _count: { _all: true } }),
    prisma.contact.groupBy({
      by: ["integrityLeadStage"],
      where: { stage: "NEW_LEAD" },
      _count: { _all: true },
    }),
  ]);
  const count = (rows: typeof totals, code: number) =>
    rows.find((r) => r.integrityLeadStage === code)?._count._all ?? 0;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrity Stages</h1>
        <p className="muted mt-1 text-sm">
          Pick the CRM stage a contact starts in when &quot;Sync from Integrity&quot; brings
          them in for the first time, based on their status in Integrity. Leave it blank to
          start them at New Lead. Syncing again never changes a stage you&apos;ve set.
        </p>
      </div>

      {mappings.length === 0 ? (
        <p className="muted text-sm">
          No Integrity statuses yet. They appear here after the first &quot;Sync from
          Integrity&quot; on the Contacts page.
        </p>
      ) : (
        <SaveForm action={saveStageMappings} submitLabel="Save" className="surface flex flex-col gap-3 p-4">
          <div className="grid grid-cols-[1fr_auto_14rem] items-center gap-x-4 gap-y-3 text-sm">
            <span className="muted text-xs font-medium">Status in Integrity</span>
            <span className="muted text-right text-xs font-medium">Contacts</span>
            <span className="muted text-xs font-medium">Starts in CRM stage</span>
            {mappings.map((m) => (
              <div key={m.code} className="contents">
                <label htmlFor={`stage-${m.code}`} className="font-medium">
                  {m.label}
                </label>
                <span className="text-right tabular-nums" title={`${count(atNewLead, m.code)} still at New Lead`}>
                  {count(totals, m.code)}
                </span>
                <select
                  id={`stage-${m.code}`}
                  name={`stage-${m.code}`}
                  defaultValue={m.pipelineStage ?? ""}
                  className="field"
                >
                  <option value="">New Lead (default)</option>
                  {STAGE_ORDER.filter((s) => s !== "NEW_LEAD").map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </SaveForm>
      )}

      <div className="surface flex flex-col gap-2 p-4">
        <h2 className="text-sm font-medium">Apply to contacts already in the CRM</h2>
        <p className="muted text-sm">
          The stages above only apply when a contact is first imported. This moves contacts
          already in the CRM that are still at New Lead into the stage picked for their
          Integrity status. Anyone you&apos;ve moved yourself is left alone. Save your choices
          above first.
        </p>
        <ul className="muted text-sm">
          {mappings
            .filter((m) => m.pipelineStage && count(atNewLead, m.code) > 0)
            .map((m) => (
              <li key={m.code}>
                {m.label}: {count(atNewLead, m.code)} at New Lead → {STAGE_LABELS[m.pipelineStage!]}
              </li>
            ))}
        </ul>
        <div>
          <ReapplyMappingsButton />
        </div>
      </div>
    </div>
  );
}
