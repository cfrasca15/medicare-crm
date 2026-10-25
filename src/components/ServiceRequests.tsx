import { SaveForm } from "@/components/SaveForm";
import {
  createServiceRequest,
  deleteServiceRequest,
  resolveServiceRequest,
  updateServiceRequest,
} from "@/lib/actions/service";
import { dateInputValue, formatDateOnly, formatDateTime, todayInputValue } from "@/lib/date";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, STATUS_CHOICES, STATUS_STYLE, statusLabel, statusValue, updateText } from "@/lib/service";

export interface ServiceRequestItem {
  id: string;
  category: string;
  title: string;
  status: string;
  waitingOn: string | null;
  followUpOn: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  policy: { carrier: string; planName: string } | null;
  updates: { id: string; summary: string; createdAt: Date }[];
}

// The Service Requests section of a contact's page: open issues with their
// latest updates, a form to open a new one, and the resolved ones folded away.
export function ServiceRequests({
  contactId,
  requests,
  plans,
}: {
  contactId: string;
  requests: ServiceRequestItem[];
  plans: { id: string; label: string }[];
}) {
  const open = requests.filter((r) => r.status !== "resolved");
  const resolved = requests.filter((r) => r.status === "resolved");
  const today = todayInputValue();

  return (
    <div className="flex flex-col gap-3">
      <details className="surface p-3">
        <summary className="link cursor-pointer text-sm font-medium">+ New service request</summary>
        <SaveForm
          action={createServiceRequest.bind(null, contactId)}
          submitLabel="Open request"
          savedLabel="Request opened ✓"
          resetOnSuccess
          primary
          className="mt-3 grid gap-2 sm:grid-cols-2"
        >
          <select name="category" required defaultValue="" className="field" aria-label="Kind of request">
            <option value="" disabled>
              What kind of request?
            </option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input name="title" required placeholder="What's the issue? e.g. New ID card not received" className="field" aria-label="Issue" />
          {plans.length > 0 && (
            <select name="policyId" defaultValue="" className="field" aria-label="Plan">
              <option value="">Not about a specific plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
          <select name="status" defaultValue="open" className="field" aria-label="Status">
            {STATUS_CHOICES.filter((c) => c.value !== "resolved").map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="muted flex items-center gap-2 text-xs">
            Follow up on
            <input type="date" name="followUpOn" min={today} className="field py-1" />
          </label>
          <input name="note" placeholder="Details (optional)" className="field sm:col-span-2" aria-label="Details" />
        </SaveForm>
      </details>

      {open.length === 0 && <p className="muted text-sm">No open service requests.</p>}
      {open.map((r) => (
        <RequestCard key={r.id} r={r} today={today} />
      ))}

      {resolved.length > 0 && (
        <details>
          <summary className="link cursor-pointer text-sm">
            {resolved.length} resolved {resolved.length === 1 ? "request" : "requests"}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {resolved.map((r) => (
              <RequestCard key={r.id} r={r} today={today} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function RequestCard({ r, today }: { r: ServiceRequestItem; today: string }) {
  const due = r.followUpOn ? dateInputValue(r.followUpOn) : null;
  const overdue = due != null && due <= today;
  const isResolved = r.status === "resolved";
  // "Opened" with no details says nothing the card doesn't already show.
  const updates = r.updates.filter((u) => updateText(u.summary, r.title) !== "Opened");
  return (
    <div className={`surface flex flex-col gap-2 p-3 text-sm ${isResolved ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{r.title}</div>
          <div className="muted mt-0.5 flex flex-wrap gap-x-3 text-xs">
            <span>{SERVICE_CATEGORY_LABELS[r.category] ?? r.category}</span>
            <span>Opened {formatDateTime(r.createdAt)}</span>
            {r.policy && (
              <span>
                {r.policy.carrier} {r.policy.planName}
              </span>
            )}
            {isResolved && r.resolvedAt && <span>Resolved {formatDateTime(r.resolvedAt)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {r.followUpOn && !isResolved && (
            <span className={`text-xs ${overdue ? "font-medium text-red-600 dark:text-red-400" : "muted"}`}>
              Follow up {formatDateOnly(r.followUpOn)}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? STATUS_STYLE.open}`}>
            {statusLabel(r)}
          </span>
        </div>
      </div>

      {updates.length > 0 && (
        <ul className="flex flex-col gap-1 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
          {updates.slice(0, 4).map((u) => (
            <li key={u.id} className="text-xs">
              <span className="muted">{formatDateTime(u.createdAt)} · </span>
              <span className="whitespace-pre-wrap">{updateText(u.summary, r.title)}</span>
            </li>
          ))}
          {updates.length > 4 && <li className="muted text-xs">and {updates.length - 4} earlier (see Activity)</li>}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <details className="flex-1">
          <summary className="link cursor-pointer text-xs">{isResolved ? "Reopen" : "Add update"}</summary>
          <SaveForm
            action={updateServiceRequest.bind(null, r.id)}
            submitLabel="Save update"
            savedLabel="Updated ✓"
            resetOnSuccess
            className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
          >
            <input name="note" placeholder="What happened? e.g. Called Humana, card mailed 10/28" className="field" aria-label="Update" />
            <select name="status" defaultValue={isResolved ? "open" : statusValue(r)} className="field" aria-label="Status">
              {STATUS_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="followUpOn"
              defaultValue={due ?? ""}
              className="field"
              aria-label="Follow up on"
              title="Follow up on"
            />
          </SaveForm>
        </details>
        {!isResolved ? (
          <form action={resolveServiceRequest.bind(null, r.id)}>
            <button type="submit" className="btn-secondary px-2.5 py-1 text-xs">
              Resolve ✓
            </button>
          </form>
        ) : (
          <form action={deleteServiceRequest.bind(null, r.id)}>
            <button type="submit" className="btn-danger-text text-xs">
              Delete
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
