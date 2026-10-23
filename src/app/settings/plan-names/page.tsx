import { prisma } from "@/lib/prisma";
import { canonicalCarrier, canonicalPlanName, carrierPlanOptions, looseKey, PLAN_CATALOG } from "@/lib/carriers";
import { renamePlan, standardizePlanNames } from "@/lib/actions/planNames";
import { SaveForm } from "@/components/SaveForm";
import { CarrierPlanFields } from "@/components/CarrierPlanFields";

export const dynamic = "force-dynamic";

export default async function PlanNamesPage() {
  const rows = await prisma.policy.groupBy({
    by: ["carrier", "planName"],
    _count: { _all: true },
    orderBy: [{ carrier: "asc" }, { planName: "asc" }],
  });
  const options = carrierPlanOptions(rows);

  const autoFixes = rows.filter((r) => {
    const c = canonicalCarrier(r.carrier);
    return c !== r.carrier || canonicalPlanName(c, r.planName) !== r.planName;
  });
  const autoFixCount = autoFixes.reduce((n, r) => n + r._count._all, 0);
  const inList = (carrier: string, plan: string) =>
    (PLAN_CATALOG[canonicalCarrier(carrier)] ?? []).some((p) => looseKey(p) === looseKey(plan));

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Carrier &amp; Plan Names</h1>
        <p className="muted mt-1 text-sm">
          Every carrier and plan name saved on a client&apos;s health plans. New plans are saved
          with the standard spelling automatically; use this page to tidy the ones already saved.
        </p>
      </div>

      <div className="surface flex flex-col gap-2 p-4">
        <h2 className="text-sm font-medium">Fix spellings automatically</h2>
        {autoFixes.length === 0 ? (
          <p className="muted text-sm">Nothing to fix: every carrier already uses its standard name.</p>
        ) : (
          <>
            <ul className="muted text-sm">
              {autoFixes.map((r) => {
                const c = canonicalCarrier(r.carrier);
                const p = canonicalPlanName(c, r.planName);
                return (
                  <li key={`${r.carrier}|${r.planName}`}>
                    {r.carrier} — {r.planName} → <span className="text-slate-900 dark:text-slate-100">{c} — {p}</span>{" "}
                    ({r._count._all})
                  </li>
                );
              })}
            </ul>
            <SaveForm
              action={standardizePlanNames}
              submitLabel={`Fix ${autoFixCount} ${autoFixCount === 1 ? "plan" : "plans"}`}
              savedLabel="Fixed ✓"
              className="flex"
            >
              {null}
            </SaveForm>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="section-label">Saved names</h2>
        <p className="muted text-sm">
          Names marked &quot;not on the 2027 list&quot; may be a duplicate of a listed plan. Use
          Change to rename every client on that name at once.
        </p>
        <div className="surface divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => {
            const rename = renamePlan.bind(null, r.carrier, r.planName);
            const listed = inList(r.carrier, r.planName);
            return (
              <div key={`${r.carrier}|${r.planName}`} className="flex flex-col gap-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.carrier}</span>
                  <span>— {r.planName}</span>
                  <span className="muted">
                    ({r._count._all} {r._count._all === 1 ? "plan" : "plans"})
                  </span>
                  {!listed && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                      not on the 2027 list
                    </span>
                  )}
                </div>
                <details>
                  <summary className="link cursor-pointer text-xs">Change</summary>
                  <SaveForm action={rename} submitLabel="Rename all" savedLabel="Renamed ✓" className="mt-2 grid grid-cols-2 gap-2">
                    <CarrierPlanFields
                      idPrefix={`rename-${looseKey(r.carrier)}-${looseKey(r.planName)}`.replace(/ /g, "-")}
                      {...options}
                      defaultCarrier={canonicalCarrier(r.carrier)}
                      defaultPlan={r.planName}
                      labelClass="text-xs font-medium"
                    />
                  </SaveForm>
                </details>
              </div>
            );
          })}
          {rows.length === 0 && <p className="muted p-4 text-sm">No health plans saved yet.</p>}
        </div>
      </div>
    </div>
  );
}
