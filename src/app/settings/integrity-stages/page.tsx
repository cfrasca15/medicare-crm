import { prisma } from "@/lib/prisma";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { upsertStageMapping, deleteStageMapping } from "@/lib/actions/stageMappings";
import { ReapplyMappingsButton } from "@/components/ReapplyMappingsButton";

export const dynamic = "force-dynamic";

export default async function IntegrityStagesPage() {
  const mappings = await prisma.integrityStageMapping.findMany({
    orderBy: { code: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrity Stage Mapping</h1>
        <p className="muted mt-1 text-sm">
          Integrity doesn&apos;t document what its numeric lead stage codes mean.
          Define them here as you learn them — when a code is mapped to a
          pipeline stage, newly-imported leads with that code will start in
          that stage automatically. Re-syncing an existing contact never
          overwrites a stage you&apos;ve already set manually.
        </p>
      </div>

      <div className="surface flex flex-col gap-2 p-4">
        <h2 className="text-sm font-medium">Apply to existing contacts</h2>
        <p className="muted text-sm">
          Mappings only apply automatically when a lead is first imported —
          contacts synced before a mapping existed are stuck at New Lead.
          This updates any contact still sitting at New Lead whose Integrity
          stage now has a mapping. Anything you&apos;ve already moved
          manually is left alone.
        </p>
        <div>
          <ReapplyMappingsButton />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {mappings.length === 0 && (
          <p className="muted text-sm">
            No mappings yet. Add one below for each stage code you see on synced
            leads (shown on a contact&apos;s detail page as &quot;stage code N&quot;).
          </p>
        )}
        {mappings.map((m) => {
          const deleteBound = deleteStageMapping.bind(null, m.code);
          return (
            <div key={m.code} className="surface flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <span className="font-medium">Code {m.code}</span>
                <span className="muted"> — {m.label}</span>
                {m.pipelineStage && (
                  <span className="muted"> → {STAGE_LABELS[m.pipelineStage]}</span>
                )}
              </div>
              <form action={deleteBound}>
                <button type="submit" className="btn-danger-text text-xs">
                  Remove
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <details className="surface p-3">
        <summary className="cursor-pointer text-sm font-medium">
          + Add / Update Mapping
        </summary>
        <form action={upsertStageMapping} className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="code">
              Stage code <span className="text-red-500">*</span>
            </label>
            <input id="code" name="code" type="number" required className="field" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="label">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              id="label"
              name="label"
              placeholder="e.g. Qualified"
              required
              className="field"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="pipelineStage">
              Maps to pipeline stage (optional)
            </label>
            <select id="pipelineStage" name="pipelineStage" defaultValue="" className="field">
              <option value="">— None —</option>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <button type="submit" className="btn-primary">
              Save Mapping
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
