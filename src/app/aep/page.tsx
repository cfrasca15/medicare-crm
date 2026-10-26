import Link from "next/link";
import { loadAepWorklist, type AepFlag, type AepRow } from "@/lib/aep";
import { isReviewed } from "@/lib/aepStatuses";
import { CALL_OUTCOME_LABELS } from "@/lib/activity";
import { formatDateOnly } from "@/lib/date";
import { AepStatusSelect } from "@/components/AepStatusSelect";
import { CallButton } from "@/components/CallButton";

export const dynamic = "force-dynamic";

// A moment in time as a Pacific date (formatDateOnly is for calendar dates).
const stamp = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" });

const FILTERS = [
  { key: "todo", label: "Still to do" },
  { key: "urgent", label: "Urgent" },
  { key: "done", label: "Reviewed" },
  { key: "all", label: "All" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const FLAG_STYLE: Record<AepFlag["tone"], string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  "heads-up": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  new: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  quiet: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default async function AepPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const params = await searchParams;
  const show: Filter = FILTERS.some((f) => f.key === params.show) ? (params.show as Filter) : "todo";
  const { season, rows, counts, alertsStatus } = await loadAepWorklist();
  const visible = rows.filter((r) =>
    show === "todo" ? !isReviewed(r.status) : show === "urgent" ? r.urgent : show === "done" ? isReviewed(r.status) : true
  );
  const pct = counts.total ? Math.round((counts.reviewed / counts.total) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">AEP Worklist</h1>
        <p className="muted mt-1 text-sm">
          AEP {season.year} runs Oct 15 – Dec 7 for {season.planYear} plans. Every client with a plan in force is listed
          here, with urgent plan and medical group changes first.
        </p>
      </div>

      <div className="surface flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span>
            <span className="font-semibold">
              {counts.reviewed} of {counts.total}
            </span>{" "}
            clients reviewed ({pct}%)
          </span>
          <span className="muted">
            {season.ended
              ? `AEP ended Dec 7, ${season.year}`
              : season.started
                ? `${season.daysLeft} day${season.daysLeft === 1 ? "" : "s"} left`
                : `Starts in ${season.daysToStart} day${season.daysToStart === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Urgent left", value: counts.urgentLeft, alert: counts.urgentLeft > 0 },
            { label: "Not contacted", value: counts.notContacted },
            { label: "Staying", value: counts.staying },
            { label: "Switching", value: counts.switching },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <div className="muted text-xs">{m.label}</div>
              <div
                className={`text-xl font-semibold tabular-nums ${m.alert ? "text-red-600 dark:text-red-400" : ""}`}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
        {alertsStatus !== "ok" && (
          <p className="muted text-xs">
            {alertsStatus === "off" ? (
              <>
                Plan ending and Group leaving tags will show once{" "}
                <Link href="/alerts" className="link">
                  Change Alerts
                </Link>{" "}
                is connected to Agent Compass.
              </>
            ) : (
              "Couldn't reach Agent Compass, so Plan ending and Group leaving tags are missing for now."
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/aep?show=${f.key}`} className={f.key === show ? "btn-primary" : "btn-secondary"}>
            {f.label}
          </Link>
        ))}
      </div>

      {/* Phones: one card per client, status on top. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {visible.map((r) => (
          <li key={r.contactId} className={`surface flex flex-col gap-2 p-3 text-sm ${isReviewed(r.status) ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <Client row={r} />
              <div className="w-40 shrink-0">
                <Status row={r} year={season.year} planYear={season.planYear} />
              </div>
            </div>
            <Plan row={r} planYear={season.planYear} />
            <LastContact row={r} />
          </li>
        ))}
        {visible.length === 0 && <li className="muted px-4 py-8 text-center text-sm">{emptyText(show, counts.total)}</li>}
      </ul>

      <div className="surface hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Last contact</th>
              <th className="w-48 px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.contactId}
                className={`table-row-hover border-t border-slate-200 align-top dark:border-slate-800 ${
                  isReviewed(r.status) ? "opacity-70" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <Client row={r} />
                </td>
                <td className="px-3 py-2">
                  <Plan row={r} planYear={season.planYear} />
                </td>
                <td className="px-3 py-2">
                  <LastContact row={r} />
                </td>
                <td className="px-3 py-2">
                  <Status row={r} year={season.year} planYear={season.planYear} />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="muted px-4 py-8 text-center">
                  {emptyText(show, counts.total)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function emptyText(show: Filter, total: number) {
  if (total === 0) return "No clients with a plan in force yet.";
  if (show === "todo") return "Everyone has been reviewed.";
  if (show === "urgent") return "No clients affected by plan or medical group changes.";
  return "Nothing here yet.";
}

function Client({ row: r }: { row: AepRow }) {
  return (
    <div>
      <Link href={`/contacts/${r.contactId}`} className="font-medium hover:underline">
        {r.name}
      </Link>
      <div className="muted flex flex-wrap items-center gap-x-2 text-xs">
        {r.age !== null && <span>Age {r.age}</span>}
        {r.phone && <span className="whitespace-nowrap">{r.phone}</span>}
        <CallButton phone={r.phone} />
      </div>
    </div>
  );
}

function Plan({ row: r, planYear }: { row: AepRow; planYear: number }) {
  return (
    <div>
      <div>{r.plan}</div>
      {r.nextPlan && (
        <div className="muted text-xs">
          {planYear}: {r.nextPlan}
        </div>
      )}
      {r.flags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {r.flags.map((f) => (
            <span key={f.label} className={`pill ${FLAG_STYLE[f.tone]}`}>
              {f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LastContact({ row: r }: { row: AepRow }) {
  return (
    <div className="text-xs">
      <div className="muted">
        {r.lastCall
          ? `${stamp(r.lastCall.at)} · ${CALL_OUTCOME_LABELS[r.lastCall.outcome ?? ""] ?? "Call"}`
          : "No calls logged"}
      </div>
      {r.nextTask && (
        <div className="mt-0.5 text-indigo-700 dark:text-indigo-300">
          Next: {r.nextTask.title} · {formatDateOnly(r.nextTask.dueDate)}
        </div>
      )}
    </div>
  );
}

function Status({ row: r, year, planYear }: { row: AepRow; year: number; planYear: number }) {
  return (
    <div>
      <AepStatusSelect key={r.status} contactId={r.contactId} year={year} status={r.status} autoReason={r.autoReason} />
      {r.status === "switching" && !r.nextPlan && (
        <Link href={`/contacts/${r.contactId}`} className="link mt-1 block text-xs">
          Add the {planYear} plan
        </Link>
      )}
    </div>
  );
}
