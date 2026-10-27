import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StageSelect } from "@/components/StageSelect";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { createPolicy, deletePolicy, updatePolicy, updatePolicyEffectiveDate } from "@/lib/actions/policies";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import {
  addContactNote,
  deleteContactNote,
  updateContactInfo,
  updateContactPerson,
  deleteContact,
} from "@/lib/actions/contacts";
import { SaveForm } from "@/components/SaveForm";
import { DeleteContactButton } from "@/components/DeleteContactButton";
import { EmailPanel } from "@/components/EmailPanel";
import { getGoogleAccount, listGmailMessagesForContact, type GmailMessageSummary } from "@/lib/google";
import { formatDateOnly, formatDateTime, dateInputValue, todayInputValue, upcomingFirstsOfMonth } from "@/lib/date";
import { EffectiveDateSelect } from "@/components/EffectiveDateSelect";
import { CommissionSelect } from "@/components/CommissionSelect";
import { ShowWhen } from "@/components/ShowWhen";
import { coverageMonth, planGroup, type PlanGroup } from "@/lib/coverage";
import { PLAN_TYPE_SEED } from "@/lib/constants";
import { carrierPlanOptions, looseKey, type CarrierPlanOptions } from "@/lib/carriers";
import { CarrierPlanFields } from "@/components/CarrierPlanFields";
import { CallButton } from "@/components/CallButton";
import { primaryPhone } from "@/lib/phone";
import { CalendarSyncButton } from "@/components/CalendarSyncButton";
import { SpouseLink } from "@/components/SpouseLink";
import { ReferralLink } from "@/components/ReferralLink";
import { SyncContactButton } from "@/components/SyncContactButton";
import { logCall, deleteActivity } from "@/lib/actions/activity";
import { CALL_OUTCOMES } from "@/lib/activity";
import { COUNTY_OPTIONS } from "@/lib/county";
import { isWebsiteSource } from "@/lib/leadSource";
import { NewServiceRequestForm, ServiceRequestList } from "@/components/ServiceRequests";
import { ToggleSection } from "@/components/ToggleSection";
import { ActivityComposer } from "@/components/ActivityComposer";
import { loadCommissionChoices, type CommissionChoices } from "@/lib/compassCommissions";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      policies: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueDate: "asc" } },
      noteEntries: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" } },
      serviceRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          policy: { select: { carrier: true, planName: true } },
          updates: { orderBy: { createdAt: "desc" }, select: { id: true, summary: true, createdAt: true } },
        },
      },
    },
  });

  if (!contact) notFound();

  const stageMapping =
    contact.integrityLeadStage != null
      ? await prisma.integrityStageMapping.findUnique({
          where: { code: contact.integrityLeadStage },
        })
      : null;

  const [carrierPlanRows, planTypeRows, groupRows, doctorRows] = await Promise.all([
    prisma.policy.findMany({ distinct: ["carrier", "planName"], select: { carrier: true, planName: true } }),
    prisma.policy.findMany({
      distinct: ["planType"],
      select: { planType: true },
      where: { planType: { not: null } },
      orderBy: { planType: "asc" },
    }),
    prisma.policy.findMany({
      distinct: ["medicalGroup"],
      select: { medicalGroup: true },
      where: { medicalGroup: { not: null } },
    }),
    prisma.policy.findMany({ distinct: ["doctor"], select: { doctor: true }, where: { doctor: { not: null } } }),
  ]);
  // Suggestions from what's already been typed, so the same group or doctor
  // is spelled the same way (the Book of Business page groups on it).
  const groupOptions = Array.from(new Set(groupRows.map((r) => (r.medicalGroup as string).trim()))).sort();
  const doctorOptions = Array.from(new Set(doctorRows.map((r) => (r.doctor as string).trim()))).sort();
  const carrierPlans = carrierPlanOptions(carrierPlanRows, contact.county);
  const planTypeOptions = Array.from(
    new Set([...PLAN_TYPE_SEED, ...planTypeRows.map((r) => r.planType as string)])
  ).sort();

  const [googleAccount, commissionChoices] = await Promise.all([getGoogleAccount(), loadCommissionChoices()]);
  let emailHistory: GmailMessageSummary[] = [];
  let emailHistoryError: string | null = null;
  if (googleAccount && contact.email) {
    try {
      emailHistory = await listGmailMessagesForContact(contact.email);
    } catch (err) {
      emailHistoryError =
        err instanceof Error ? err.message : "Failed to load email history.";
    }
  }

  const createPolicyForContact = createPolicy.bind(null, contact.id);
  const addNoteForContact = addContactNote.bind(null, contact.id);
  const updateInfoForContact = updateContactInfo.bind(null, contact.id);
  const updatePersonForContact = updateContactPerson.bind(null, contact.id);
  const logCallForContact = logCall.bind(null, contact.id);

  // One newest-first history: notes, calls, stage changes, plans and tasks.
  type TimelineItem = {
    key: string;
    kind: "note" | "call" | "stage" | "plan" | "task" | "done" | "service";
    at: Date;
    text: string;
    remove?: () => Promise<void>;
  };
  const timeline: TimelineItem[] = [
    ...contact.noteEntries.map((n) => ({
      key: `n-${n.id}`,
      kind: "note" as const,
      at: n.createdAt,
      text: n.body,
      remove: deleteContactNote.bind(null, contact.id, n.id),
    })),
    ...contact.activities.map((a) => ({
      key: `a-${a.id}`,
      kind: (a.type === "call" ? "call" : a.type === "service" ? "service" : "stage") as "call" | "stage" | "service",
      at: a.createdAt,
      text: a.summary,
      remove: a.type === "call" ? deleteActivity.bind(null, contact.id, a.id) : undefined,
    })),
    ...contact.policies.map((p) => ({
      key: `p-${p.id}`,
      kind: "plan" as const,
      at: p.createdAt,
      text: `Added ${p.timing === "future" ? "future" : "current"} plan: ${p.carrier} ${p.planName}${
        p.effectiveDate ? ` (effective ${formatDateOnly(p.effectiveDate)})` : ""
      }`,
    })),
    ...contact.tasks.flatMap((tk) => [
      { key: `t-${tk.id}`, kind: "task" as const, at: tk.createdAt, text: `Task added: ${tk.title}` },
      ...(tk.status === "DONE"
        ? [{ key: `d-${tk.id}`, kind: "done" as const, at: tk.updatedAt, text: `Task done: ${tk.title}` }]
        : []),
    ]),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const deleteContactBound = deleteContact.bind(null, contact.id);
  const effectiveChoices = upcomingFirstsOfMonth();
  const plansByGroup: Record<PlanGroup, typeof contact.policies> = { current: [], future: [], previous: [] };
  for (const p of contact.policies) plansByGroup[planGroup(p)].push(p);
  const spouse = contact.spouseId
    ? await prisma.contact.findUnique({
        where: { id: contact.spouseId },
        select: { id: true, firstName: true, lastName: true },
      })
    : null;
  const [referrer, referrals] = await Promise.all([
    contact.referredById
      ? prisma.contact.findUnique({ where: { id: contact.referredById }, select: { id: true, firstName: true, lastName: true } })
      : null,
    prisma.contact.findMany({
      where: { referredById: contact.id },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ]);
  const openRequestCount = contact.serviceRequests.filter((r) => r.status !== "resolved").length;
  const callPhone = primaryPhone(contact);
  const otherPhone = callPhone?.isCell ? contact.phone : contact.cellPhone;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div className="-mb-5">
        <Link href="/contacts" className="link text-sm">
          ← All contacts
        </Link>
      </div>
      <div className="surface flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 gap-4">
          <span
            aria-hidden="true"
            className="hidden h-12 w-12 shrink-0 sm:flex items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
          >
            {(contact.firstName[0] ?? "").toUpperCase()}
            {(contact.lastName[0] ?? "").toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contact.firstName} {contact.lastName}
            </h1>
            <div className="muted mt-1 flex flex-wrap items-center gap-4 text-sm">
              {callPhone && (
                <span className="flex items-center gap-2">
                  {callPhone.isCell ? "Cell " : ""}
                  {callPhone.number}
                  <CallButton phone={callPhone.number} />
                </span>
              )}
              {callPhone && otherPhone && (
                <span className="flex items-center gap-2">
                  {callPhone.isCell ? "Other " : "Cell "}
                  {otherPhone}
                  <CallButton phone={otherPhone} />
                </span>
              )}
              {contact.email && <span>{contact.email}</span>}
              {contact.county && <span>{contact.county} County</span>}
              {contact.integrityContactId && stageMapping && <span>Integrity: {stageMapping.label}</span>}
              {(isWebsiteSource(contact.leadSource) || contact.lastWebsiteLeadAt) && (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-200">
                  {isWebsiteSource(contact.leadSource) ? contact.leadSource : "Website: returning contact"}
                  {contact.lastWebsiteLeadAt
                    ? ` · latest ${contact.lastWebsiteLeadAt.toLocaleDateString("en-US")}`
                    : ""}
                </span>
              )}
              {contact.leadSource && !isWebsiteSource(contact.leadSource) && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Source: {contact.leadSource}
                </span>
              )}
              {contact.medicaid && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                  Medi-Cal
                </span>
              )}
              {contact.extraHelp && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                  Extra Help
                </span>
              )}
            </div>
            {contact.altContactName && (
              <div
                className={`mt-2 flex flex-wrap items-center gap-2 text-sm ${
                  contact.altContactPreferred
                    ? "rounded-md bg-amber-50 px-3 py-1.5 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
                    : "muted"
                }`}
              >
                <span className="font-medium">
                  {contact.altContactPreferred ? "Call instead:" : "Contact person:"}
                </span>
                <span>
                  {contact.altContactName}
                  {contact.altContactRelationship ? ` (${contact.altContactRelationship})` : ""}
                </span>
                {contact.altContactPhone && (
                  <span className="flex items-center gap-2">
                    {contact.altContactPhone}
                    <CallButton phone={contact.altContactPhone} />
                  </span>
                )}
                {contact.altContactEmail && <span>{contact.altContactEmail}</span>}
              </div>
            )}
            {(plansByGroup.current.length > 0 || plansByGroup.future.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {plansByGroup.current.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                  >
                    Current: {planLabel(p)}
                    {p.effectiveDate && coverageMonth(p.effectiveDate) !== null && (
                      <span className="font-normal opacity-80"> · Month {coverageMonth(p.effectiveDate)}</span>
                    )}
                  </span>
                ))}
                {plansByGroup.future.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  >
                    {p.effectiveDate ? `Starting ${formatDateOnly(p.effectiveDate)}` : "Future"}: {planLabel(p)}
                  </span>
                ))}
              </div>
            )}
            {/* Spouse and referral on one line. */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <SpouseLink
                key={`spouse-${spouse?.id ?? "none"}`}
                contactId={contact.id}
                spouse={spouse ? { id: spouse.id, name: `${spouse.firstName} ${spouse.lastName}` } : null}
              />
              <ReferralLink
                key={`referrer-${referrer?.id ?? "none"}`}
                contactId={contact.id}
                referrer={referrer ? { id: referrer.id, name: `${referrer.firstName} ${referrer.lastName}` } : null}
              />
              {referrals.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  <span className="muted">
                    Referred {referrals.length} {referrals.length === 1 ? "person" : "people"}:
                  </span>
                  {referrals.map((r, i) => (
                    <span key={r.id}>
                      <Link href={`/contacts/${r.id}`} className="link">
                        {r.firstName} {r.lastName}
                      </Link>
                      {i < referrals.length - 1 ? "," : ""}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {contact.integrityContactId && (
            // Doctors, drugs and pharmacies live in Integrity (its API can't
            // send them back), so this opens the client there.
            <a
              href={`https://connect.integrity.com/agent/clients/contact/${contact.integrityContactId}/overview`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Open in Integrity ↗
            </a>
          )}
          {contact.integrityContactId && <SyncContactButton contactId={contact.id} />}
          <Link href={`/book?contact=${contact.id}`} className="btn-secondary whitespace-nowrap">
            Book appointment
          </Link>
          <StageSelect key={contact.stage} contactId={contact.id} stage={contact.stage} />
          <DeleteContactButton
            name={`${contact.firstName} ${contact.lastName}`}
            action={deleteContactBound}
          />
        </div>
      </div>

      {/* Two columns on wide screens: plans and activity on the left; tasks,
          client info and contact person on the right (a little wider on big
          screens). Narrower screens get one column, in the order set by each
          section's order- class. */}
      <div className="contents lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-6">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <ToggleSection
            title="Health Plans"
            className="order-3 lg:order-none"
            note={contact.policies.length ? undefined : "none"}
            actionLabel="+ Add plan"
            form={
              <SaveForm
                action={createPolicyForContact}
                submitLabel="Add Health Plan"
                savedLabel="Health plan added ✓"
                resetOnSuccess
                primary
                className="surface grid grid-cols-2 gap-3 p-3"
              >
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-sm font-medium">
                    Client <span className="text-red-500">*</span>
                  </legend>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="clientType" value="new" required className="accent-indigo-600" />
                      New client
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="clientType" value="current" required className="accent-indigo-600" />
                      Current client
                    </label>
                  </div>
                </fieldset>
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-sm font-medium">
                    Plan <span className="text-red-500">*</span>
                  </legend>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="timing" value="current" required className="accent-indigo-600" />
                      Current plan
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="timing" value="future" required className="accent-indigo-600" />
                      Future plan
                    </label>
                  </div>
                </fieldset>
                <CarrierPlanFields idPrefix="add" {...carrierPlans} />
                <PolicyField
                  label="Plan Type"
                  name="planType"
                  placeholder="MAPD, PDP, Med Supp..."
                  options={planTypeOptions}
                />
                <ShowWhen field="timing" value="future">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" htmlFor="effectiveDate">
                      Effective Date
                    </label>
                    <EffectiveDateSelect id="effectiveDate" name="effectiveDate" choices={effectiveChoices} />
                    {plansByGroup.current.length > 0 && (
                      <label className="muted mt-1 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          name="replacesCurrent"
                          defaultChecked
                          className="h-3.5 w-3.5 accent-indigo-600"
                        />
                        Replaces their current plan (it ends the day before this one starts)
                      </label>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" htmlFor="submittedAt">
                      Date Submitted
                    </label>
                    <input
                      id="submittedAt"
                      name="submittedAt"
                      type="date"
                      defaultValue={todayInputValue()}
                      className="field"
                    />
                  </div>
                </ShowWhen>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" htmlFor="commissionAmount">
                    Commission Amount
                  </label>
                  <CommissionSelect
                    id="commissionAmount"
                    name="commissionAmount"
                    choices={commissionChoices}
                    county={contact.county}
                  />
                </div>
                <PolicyField label="Doctor" name="doctor" options={doctorOptions} />
                <PolicyField label="Medical Group" name="medicalGroup" options={groupOptions} />
              </SaveForm>
            }
          >
            {(plansByGroup.current.length > 0 || plansByGroup.future.length > 0) && (
              <div
                className={`grid gap-3 ${plansByGroup.current.length && plansByGroup.future.length ? "md:grid-cols-2" : ""}`}
              >
                {(["current", "future"] as const)
                  .filter((group) => plansByGroup[group].length > 0)
                  .map((group) => (
                    <div key={group} className="flex flex-col gap-2">
                      <h3 className="muted text-xs font-medium">{group === "current" ? "Current plan" : "Future plan"}</h3>
                      {plansByGroup[group].map((p) => (
                        <PolicyCard
                          key={p.id}
                          contactId={contact.id}
                          policy={p}
                          group={group}
                          effectiveChoices={effectiveChoices}
                          carrierPlans={carrierPlans}
                          commissionChoices={commissionChoices}
                          county={contact.county}
                        />
                      ))}
                    </div>
                  ))}
              </div>
            )}
            {plansByGroup.previous.length > 0 && (
              <details className="mt-2">
                <summary className="link cursor-pointer text-xs font-medium">
                  Plan history ({plansByGroup.previous.length} previous {plansByGroup.previous.length === 1 ? "plan" : "plans"})
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  {plansByGroup.previous.map((p) => (
                    <PolicyCard
                      key={p.id}
                      contactId={contact.id}
                      policy={p}
                      group="previous"
                      effectiveChoices={effectiveChoices}
                      carrierPlans={carrierPlans}
                      commissionChoices={commissionChoices}
                      county={contact.county}
                    />
                  ))}
                </div>
              </details>
            )}
          </ToggleSection>

          <section className="order-6 lg:order-none">
            <h2 className="section-label mb-3">
              Activity
              {openRequestCount > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal text-amber-700 dark:text-amber-300">
                  {openRequestCount} open service {openRequestCount === 1 ? "request" : "requests"}
                </span>
              )}
            </h2>
            <div className="mb-4 flex flex-col gap-3">
              <ActivityComposer
                note={
                  <SaveForm
                    action={addNoteForContact}
                    submitLabel="Add Note"
                    savedLabel="Note added ✓"
                    resetOnSuccess
                    primary
                    className="flex flex-col gap-2"
                  >
                    <textarea name="body" placeholder="Add a note…" rows={3} required className="field" />
                  </SaveForm>
                }
                call={
                  <SaveForm
                    action={logCallForContact}
                    submitLabel="Log Call"
                    savedLabel="Call logged ✓"
                    resetOnSuccess
                    primary
                    className="flex flex-col gap-2"
                  >
                    <select name="outcome" required defaultValue="" className="field" aria-label="How the call went">
                      <option value="" disabled>
                        How did the call go?
                      </option>
                      {CALL_OUTCOMES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input name="note" placeholder="Quick note (optional)" className="field" />
                    <label className="muted flex items-center gap-2 text-xs">
                      Follow up on
                      <input type="date" name="followUp" className="field py-1" />
                      <span>(adds a task)</span>
                    </label>
                  </SaveForm>
                }
                request={
                  <NewServiceRequestForm
                    bare
                    contactId={contact.id}
                    plans={[...plansByGroup.current, ...plansByGroup.future, ...plansByGroup.previous].map((p) => ({
                      id: p.id,
                      label: `${p.carrier} ${p.planName}${p.effectiveDate ? ` (eff. ${formatDateOnly(p.effectiveDate)})` : ""}`,
                    }))}
                  />
                }
              />
              {contact.serviceRequests.length > 0 && (
                <div className="flex flex-col gap-2">
                  {openRequestCount > 0 && (
                    <h3 className="muted text-xs font-medium">
                      Open service {openRequestCount === 1 ? "request" : "requests"}
                    </h3>
                  )}
                  <ServiceRequestList requests={contact.serviceRequests} />
                </div>
              )}
            </div>

            <ol className="relative flex flex-col gap-2 border-l border-slate-200 pl-4 dark:border-slate-800">
              {timeline.length === 0 && <p className="muted text-sm">Nothing yet.</p>}
              {timeline.map((item) => (
                <li key={item.key} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute top-3 -left-[21px] h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${TIMELINE_DOT[item.kind]}`}
                  />
                  <div className="surface flex items-start justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <div className="muted text-xs">
                        {TIMELINE_LABEL[item.kind]} · {formatDateTime(item.at)}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap">{item.text}</div>
                    </div>
                    {item.remove && (
                      <form action={item.remove}>
                        <button type="submit" className="btn-danger-text text-xs">
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="order-7 lg:order-none">
            <h2 className="section-label mb-3">Email</h2>
            {!contact.email && (
              <p className="muted text-sm">Add an email address to send or track email.</p>
            )}
            {contact.email && !googleAccount && (
              <p className="muted text-sm">
                Connect your Google account on the{" "}
                <Link href="/settings/google" className="link">
                  Google
                </Link>{" "}
                settings page to send and track email here.
              </p>
            )}
            {contact.email && googleAccount && emailHistoryError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Couldn&apos;t load email history: {emailHistoryError}. If you
                connected Google before Gmail access was added, reconnect on the{" "}
                <Link href="/settings/google" className="link">
                  Google
                </Link>{" "}
                settings page to grant it.
              </p>
            )}
            {contact.email && googleAccount && !emailHistoryError && (
              <EmailPanel contactId={contact.id} history={emailHistory} />
            )}
          </section>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <ToggleSection
            title="Tasks"
            className="order-1 lg:order-none"
            note={contact.tasks.length ? undefined : "none"}
            actionLabel="+ Add task"
            form={
              <SaveForm
                action={createTask}
                submitLabel="Add Task"
                savedLabel="Task added ✓"
                resetOnSuccess
                primary
                className="surface flex flex-wrap items-center gap-2 p-3"
              >
              <input type="hidden" name="contactId" value={contact.id} />
              <input
                name="title"
                placeholder="Add a task or follow-up…"
                aria-label="Task"
                required
                className="field min-w-48 flex-1"
              />
              <input name="dueDate" type="date" aria-label="Due date" title="Due date" className="field" />
              <input name="notes" placeholder="Notes (optional)" aria-label="Notes" className="field min-w-40 flex-1" />
              </SaveForm>
            }
          >
            {contact.tasks.length > 0 && (
              <div className="flex flex-col gap-2">
              {contact.tasks.map((t) => {
                const deleteTaskBound = deleteTask.bind(null, t.id);
                return (
                  <div key={t.id} className="surface flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <TaskCheckbox taskId={t.id} done={t.status === "DONE"} />
                      <span className={t.status === "DONE" ? "muted line-through" : ""}>
                        {t.title}
                      </span>
                      {t.dueDate && <span className="muted text-xs">{formatDateOnly(t.dueDate)}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {t.dueDate && (
                        <CalendarSyncButton taskId={t.id} synced={!!t.googleEventId} />
                      )}
                      <form action={deleteTaskBound}>
                        <button type="submit" className="btn-danger-text text-xs">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </ToggleSection>

          <ToggleSection
            title="Client Info"
            className="order-4 lg:order-none"
            actionLabel="Edit"
            closeLabel="Done"
            hideWhenOpen
            form={
              <div className="@container">
              <SaveForm action={updateInfoForContact} className={INFO_FORM}>
              <Field label="First Name" name="firstName" value={contact.firstName} span={2} required />
              <Field label="Last Name" name="lastName" value={contact.lastName} span={2} required />
              <Field
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                value={contact.dateOfBirth ? dateInputValue(contact.dateOfBirth) : null}
                span={2}
              />
              <Field label="Phone" name="phone" type="tel" value={contact.phone} span={2} />
              <div className="col-span-1 flex min-w-0 flex-col gap-1 @lg:col-span-2">
                <label className="text-sm font-medium" htmlFor="info-cellPhone">
                  Cell Phone
                </label>
                <input
                  id="info-cellPhone"
                  name="cellPhone"
                  type="tel"
                  defaultValue={contact.cellPhone ?? ""}
                  className="field"
                />
                <label className="muted flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="cellPreferred"
                    defaultChecked={contact.cellPreferred}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  Preferred — Call button dials the cell
                </label>
              </div>
              <Field label="Email" name="email" type="email" value={contact.email} span={2} wide />
              <Field label="Address" name="address" value={contact.address} span={3} />
              <Field label="City" name="city" value={contact.city} span={1} wide />
              <Field label="State" name="state" value={contact.state} span={1} />
              <Field label="ZIP" name="zip" value={contact.zip} span={1} />
              <div className="col-span-1 flex min-w-0 flex-col gap-1 @lg:col-span-2">
                <label className="text-sm font-medium" htmlFor="info-county">
                  County
                </label>
                <input
                  id="info-county"
                  name="county"
                  list="county-options"
                  defaultValue={contact.county ?? ""}
                  placeholder="Filled from the ZIP if blank"
                  className="field"
                />
                <datalist id="county-options">
                  {COUNTY_OPTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="col-span-2 flex flex-wrap items-end gap-x-6 gap-y-2 pb-2 text-sm @lg:col-span-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="medicaid" defaultChecked={contact.medicaid} className="h-4 w-4 accent-indigo-600" />
                  Medi-Cal
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="extraHelp" defaultChecked={contact.extraHelp} className="h-4 w-4 accent-indigo-600" />
                  Extra Help (LIS)
                </label>
              </div>
              <ShowWhen field="medicaid" value="on" initial={contact.medicaid ? "on" : ""}>
                <Field label="Medi-Cal Number" name="medicaidId" value={contact.medicaidId} span={2} />
              </ShowWhen>
              <label className="col-span-full flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="hasMailingAddress"
                  defaultChecked={contact.hasMailingAddress}
                  className="h-4 w-4 accent-indigo-600"
                />
                Different mailing address
              </label>
              <ShowWhen field="hasMailingAddress" value="on" initial={contact.hasMailingAddress ? "on" : ""}>
                <Field label="Mailing Address" name="mailingAddress" value={contact.mailingAddress} span={3} />
                <Field label="City" name="mailingCity" value={contact.mailingCity} span={1} wide />
                <Field label="State" name="mailingState" value={contact.mailingState} span={1} />
                <Field label="ZIP" name="mailingZip" value={contact.mailingZip} span={1} />
              </ShowWhen>
              <Field label="Medicare Number" name="medicareId" value={contact.medicareId} span={2} />
              <Field
                label="Part A Effective"
                name="partAEffectiveDate"
                type="date"
                value={contact.partAEffectiveDate ? dateInputValue(contact.partAEffectiveDate) : null}
                span={2}
              />
              <Field
                label="Part B Effective"
                name="partBEffectiveDate"
                type="date"
                value={contact.partBEffectiveDate ? dateInputValue(contact.partBEffectiveDate) : null}
                span={2}
              />
              </SaveForm>
              </div>
            }
          >
            <InfoSummary
              items={[
                ["Date of birth", contact.dateOfBirth ? `${formatDateOnly(contact.dateOfBirth)} (age ${ageFrom(contact.dateOfBirth)})` : null],
                ["Medicare number", contact.medicareId],
                ...(contact.medicaid ? [["Medi-Cal number", contact.medicaidId] as [string, string | null]] : []),
                ["County", contact.county],
                ["Phone", contact.phone],
                ["Cell", contact.cellPhone ? `${contact.cellPhone}${contact.cellPreferred ? " (preferred)" : ""}` : null],
                ["Email", contact.email],
                ["Address", joinAddress(contact.address, contact.city, contact.state, contact.zip)],
                ...(contact.hasMailingAddress
                  ? [["Mailing address", joinAddress(contact.mailingAddress, contact.mailingCity, contact.mailingState, contact.mailingZip)] as [string, string | null]]
                  : []),
                [
                  "Part A / Part B",
                  contact.partAEffectiveDate || contact.partBEffectiveDate
                    ? `${contact.partAEffectiveDate ? formatDateOnly(contact.partAEffectiveDate) : "—"} / ${
                        contact.partBEffectiveDate ? formatDateOnly(contact.partBEffectiveDate) : "—"
                      }`
                    : null,
                ],
                ["Medi-Cal / Extra Help", [contact.medicaid && "Medi-Cal", contact.extraHelp && "Extra Help"].filter(Boolean).join(", ") || "No"],
              ]}
            />
          </ToggleSection>

          <ToggleSection
            title="Contact Person"
            className="order-5 lg:order-none"
            note={contact.altContactName ? undefined : "none"}
            actionLabel={contact.altContactName ? "Edit" : "+ Add"}
            closeLabel="Done"
            hideWhenOpen
            form={
              <div className="@container">
              <SaveForm action={updatePersonForContact} className={INFO_FORM}>
                <p className="muted col-span-full text-sm">A son, daughter, spouse or caregiver who handles things for this client.</p>
              <Field label="Name" name="altContactName" value={contact.altContactName} span={2} />
              <Field
                label="Relationship"
                name="altContactRelationship"
                value={contact.altContactRelationship}
                span={2}
              />
              <Field label="Phone" name="altContactPhone" type="tel" value={contact.altContactPhone} span={2} />
              <Field label="Email" name="altContactEmail" type="email" value={contact.altContactEmail} span={3} wide />
              <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm @lg:col-span-3">
                <input
                  type="checkbox"
                  name="altContactPreferred"
                  defaultChecked={contact.altContactPreferred}
                  className="h-4 w-4 accent-indigo-600"
                />
                Call this person instead of the client
              </label>
              </SaveForm>
              </div>
            }
          >
            {contact.altContactName && (
              <p className="surface px-4 py-3 text-sm">
                <span className="font-medium">{contact.altContactName}</span>
                {[
                  contact.altContactRelationship,
                  contact.altContactPhone,
                  contact.altContactEmail,
                  contact.altContactPreferred ? "call this person instead of the client" : null,
                ]
                  .filter(Boolean)
                  .map((x) => ` · ${x}`)
                  .join("")}
              </p>
            )}
          </ToggleSection>
        </div>
      </div>
    </div>
  );
}

// Read-only Client Info: label / value pairs, a dash for anything blank.
function InfoSummary({ items }: { items: [string, string | null | undefined][] }) {
  return (
    // Three columns where there's room, two in the narrow side column.
    <div className="@container">
      <dl className="surface grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-sm @lg:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="muted text-xs">{label}</dt>
            <dd className="break-words">{value || <span className="muted">—</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// "123 Main St Anaheim, CA 92801", or null when there's nothing.
function joinAddress(street: string | null, city: string | null, state: string | null, zip: string | null): string | null {
  return [street, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
}

// Age today (Pacific) from a date of birth stored as a calendar date.
function ageFrom(dob: Date): number {
  const [y, m, d] = todayInputValue().split("-").map(Number);
  const before = m < dob.getUTCMonth() + 1 || (m === dob.getUTCMonth() + 1 && d < dob.getUTCDate());
  return y - dob.getUTCFullYear() - (before ? 1 : 0);
}

// Client Info and Contact Person forms: two boxes to a row in the narrow
// right-hand column, six-column rows when the form has the page's width.
const INFO_FORM = "surface grid grid-cols-2 gap-3 p-4 @lg:grid-cols-6";

// Grid spans for that layout (literal class names so Tailwind picks them
// up). Half a row when narrow; a span of 3, or `wide`, takes the full row.
const SPANS: Record<number, string> = {
  1: "col-span-1 @lg:col-span-1",
  2: "col-span-1 @lg:col-span-2",
  3: "col-span-2 @lg:col-span-3",
};
const WIDE_SPANS: Record<number, string> = {
  1: "col-span-2 @lg:col-span-1",
  2: "col-span-2 @lg:col-span-2",
  3: "col-span-2 @lg:col-span-3",
};

function Field({
  label,
  name,
  value,
  type = "text",
  span,
  wide = false,
  required = false,
}: {
  label: string;
  name: string;
  value?: string | null;
  type?: string;
  span?: number;
  wide?: boolean; // full row in the narrow layout
  required?: boolean;
}) {
  // Prefixed so these don't collide with the Add Policy form's ids.
  const id = `info-${name}`;
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${span ? (wide ? WIDE_SPANS : SPANS)[span] : ""}`}>
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={value ?? ""}
        className="field"
      />
    </div>
  );
}

function PolicyField({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  options,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}) {
  const listId = options ? `${name}-options` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        list={listId}
        autoComplete={listId ? "off" : undefined}
        className="field"
      />
      {options && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </div>
  );
}

// True when the plan name already says the carrier ("SCAN Classic").
function nameHasCarrier(p: { carrier: string; planName: string }): boolean {
  return looseKey(p.planName).includes(looseKey(p.carrier).split(" ")[0]);
}

// "SCAN Classic (HMO)" as is; the carrier added when the name leaves it out.
function planLabel(p: { carrier: string; planName: string }): string {
  return nameHasCarrier(p) ? p.planName : `${p.carrier} ${p.planName}`;
}

type ContactPolicy = Awaited<ReturnType<typeof prisma.policy.findMany>>[number];

function PolicyCard({
  contactId,
  policy: p,
  group,
  effectiveChoices,
  carrierPlans,
  commissionChoices,
  county,
}: {
  contactId: string;
  policy: ContactPolicy;
  group: PlanGroup;
  effectiveChoices: { value: string; label: string }[];
  carrierPlans: CarrierPlanOptions;
  commissionChoices: CommissionChoices;
  county: string | null;
}) {
  const deletePolicyForContact = deletePolicy.bind(null, contactId, p.id);
  const setEffectiveDate = updatePolicyEffectiveDate.bind(null, contactId, p.id);
  const savePolicy = updatePolicy.bind(null, contactId, p.id);
  const fid = (name: string) => `policy-${p.id}-${name}`;
  const month = p.effectiveDate ? coverageMonth(p.effectiveDate) : null;
  // The plan type is often in the name already ("Value Script (PDP)").
  const showType = p.planType && !p.planName.toLowerCase().includes(p.planType.toLowerCase());
  const showCarrier = !nameHasCarrier(p);
  const facts = [
    p.clientType === "new" ? "New client" : p.clientType === "current" ? "Current client" : null,
    group === "current" && month !== null ? `Month ${month}` : null,
    p.effectiveDate ? `${group === "future" ? "Starts" : "Effective"} ${formatDateOnly(p.effectiveDate)}` : null,
    p.submittedAt ? `Submitted ${formatDateOnly(p.submittedAt)}` : null,
    p.termDate ? `${group === "previous" ? "Ended" : "Ends"} ${formatDateOnly(p.termDate)}` : null,
    p.commissionAmount != null
      ? `$${p.commissionAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} commission`
      : null,
    p.policyNumber ? `Policy #${p.policyNumber}` : null,
    p.doctor ? (/^dr\.?\s/i.test(p.doctor) ? p.doctor : `Dr. ${p.doctor}`) : null,
    p.medicalGroup,
  ].filter(Boolean);
  // One compact card; clicking it opens the edit panel underneath.
  return (
    <details className="surface group text-sm">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="font-medium">
            {p.planName}
            {showType && ` (${p.planType})`}
            {showCarrier && <span className="muted font-normal"> · {p.carrier}</span>}
          </div>
          {facts.length > 0 && <div className="muted mt-0.5 text-xs">{facts.join(" · ")}</div>}
        </div>
        <span className="link shrink-0 text-xs">
          <span className="group-open:hidden">Edit</span>
          <span className="hidden group-open:inline">Close</span>
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-slate-200 p-3 dark:border-slate-800">
        {group === "future" && (
          <SaveForm action={setEffectiveDate} className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Effective date
              <EffectiveDateSelect
                name="effectiveDate"
                choices={effectiveChoices}
                defaultValue={p.effectiveDate ? dateInputValue(p.effectiveDate) : ""}
              />
            </label>
          </SaveForm>
        )}
        <SaveForm action={savePolicy} className="mt-2 grid grid-cols-2 gap-2">
          <CarrierPlanFields
            idPrefix={`policy-${p.id}`}
            {...carrierPlans}
            defaultCarrier={p.carrier}
            defaultPlan={p.planName}
            labelClass="text-xs font-medium"
          />
          <EditPolicyField label="Plan Type" id={fid("planType")} name="planType" value={p.planType} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor={fid("clientType")}>
              New / Current client
            </label>
            <select id={fid("clientType")} name="clientType" defaultValue={p.clientType ?? ""} className="field">
              <option value="">Not set</option>
              <option value="new">New client</option>
              <option value="current">Current client</option>
            </select>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor={fid("commissionAmount")}>
              Commission Amount
            </label>
            <CommissionSelect
              id={fid("commissionAmount")}
              name="commissionAmount"
              choices={commissionChoices}
              county={county}
              initialCarrier={p.carrier}
              initialPlan={p.planName}
              defaultAmount={p.commissionAmount}
            />
          </div>
          <EditPolicyField label="Doctor" id={fid("doctor")} name="doctor" value={p.doctor} />
          <EditPolicyField label="Medical Group" id={fid("medicalGroup")} name="medicalGroup" value={p.medicalGroup} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor={fid("submittedAt")}>
              Date Submitted
            </label>
            <input
              id={fid("submittedAt")}
              name="submittedAt"
              type="date"
              defaultValue={p.submittedAt ? dateInputValue(p.submittedAt) : ""}
              className="field"
            />
          </div>
            <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor={fid("termDate")}>
              End date
            </label>
            <input
              id={fid("termDate")}
              name="termDate"
              type="date"
              defaultValue={p.termDate ? dateInputValue(p.termDate) : ""}
              title="The last day of coverage; after it the plan moves to Plan history"
              className="field"
            />
          </div>
        </SaveForm>
        <form action={deletePolicyForContact}>
          <button type="submit" className="btn-danger-text text-xs">
            Remove this plan
          </button>
        </form>
      </div>
    </details>
  );
}

function EditPolicyField({
  label,
  id,
  name,
  value,
  required = false,
}: {
  label: string;
  id: string;
  name: string;
  value: string | null;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" htmlFor={id}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input id={id} name={name} defaultValue={value ?? ""} required={required} className="field" />
    </div>
  );
}

const TIMELINE_LABEL: Record<string, string> = {
  note: "Note",
  call: "Call",
  stage: "Stage",
  plan: "Health plan",
  task: "Task",
  done: "Task done",
  service: "Service request",
};

const TIMELINE_DOT: Record<string, string> = {
  note: "bg-slate-400",
  call: "bg-indigo-500",
  stage: "bg-amber-500",
  plan: "bg-emerald-500",
  task: "bg-sky-400",
  done: "bg-sky-600",
  service: "bg-teal-500",
};
