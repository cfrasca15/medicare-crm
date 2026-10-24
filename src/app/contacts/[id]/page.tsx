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
import { PushToIntegrityButton } from "@/components/PushToIntegrityButton";
import { DeleteContactButton } from "@/components/DeleteContactButton";
import { EmailPanel } from "@/components/EmailPanel";
import { getGoogleAccount, listGmailMessagesForContact, type GmailMessageSummary } from "@/lib/google";
import { formatDateOnly, formatDateTime, dateInputValue, todayInputValue, upcomingFirstsOfMonth } from "@/lib/date";
import { EffectiveDateSelect } from "@/components/EffectiveDateSelect";
import { CommissionSelect } from "@/components/CommissionSelect";
import { ShowWhen } from "@/components/ShowWhen";
import { coverageMonth, planGroup, type PlanGroup } from "@/lib/coverage";
import { PLAN_TYPE_SEED } from "@/lib/constants";
import { carrierPlanOptions, type CarrierPlanOptions } from "@/lib/carriers";
import { CarrierPlanFields } from "@/components/CarrierPlanFields";
import { CallButton } from "@/components/CallButton";
import { primaryPhone } from "@/lib/phone";
import { CalendarSyncButton } from "@/components/CalendarSyncButton";
import { SpouseLink } from "@/components/SpouseLink";
import { COUNTY_OPTIONS } from "@/lib/county";
import { isWebsiteSource } from "@/lib/leadSource";

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

  const googleAccount = await getGoogleAccount();
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
  const callPhone = primaryPhone(contact);
  const otherPhone = callPhone?.isCell ? contact.phone : contact.cellPhone;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div className="-mb-5">
        <Link href="/contacts" className="link text-sm">
          ← All contacts
        </Link>
      </div>
      <div className="surface flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 gap-4">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
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
                <span>
                  {callPhone.isCell ? "Other " : "Cell "}
                  {otherPhone}
                </span>
              )}
              {contact.email && <span>{contact.email}</span>}
              {contact.county && <span>{contact.county} County</span>}
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
                    Current: {p.carrier} {p.planName}
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
                    {p.effectiveDate ? `Starting ${formatDateOnly(p.effectiveDate)}` : "Future"}: {p.carrier} {p.planName}
                  </span>
                ))}
              </div>
            )}
            <SpouseLink
              key={spouse?.id ?? "none"}
              contactId={contact.id}
              spouse={spouse ? { id: spouse.id, name: `${spouse.firstName} ${spouse.lastName}` } : null}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
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

      <section>
        <h2 className="section-label mb-3">Tasks</h2>
        <SaveForm
          action={createTask}
          submitLabel="Add Task"
          savedLabel="Task added ✓"
          resetOnSuccess
          primary
          className="surface mb-3 flex flex-wrap items-center gap-2 p-3"
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
        <div className="flex flex-col gap-2">
          {contact.tasks.length === 0 && <p className="muted text-sm">No tasks yet.</p>}
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
      </section>

      <section>
        <h2 className="section-label mb-3">Health Plans</h2>
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {(["current", "future"] as const).map((group) => {
            const list = plansByGroup[group];
            return (
              <div key={group} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{group === "current" ? "Current plan" : "Future plan"}</h3>
                {list.length === 0 && (
                  <p className="muted surface p-3 text-sm">
                    {group === "current" ? "No current plan entered." : "No future plan entered."}
                  </p>
                )}
                {list.map((p) => (
                  <PolicyCard
                    key={p.id}
                    contactId={contact.id}
                    policy={p}
                    group={group}
                    effectiveChoices={effectiveChoices}
                    carrierPlans={carrierPlans}
                  />
                ))}
              </div>
            );
          })}
        </div>
        {plansByGroup.previous.length > 0 && (
          <details className="mb-4">
            <summary className="muted cursor-pointer text-sm">
              Previous plans ({plansByGroup.previous.length})
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
                />
              ))}
            </div>
          </details>
        )}

        <details className="surface p-3">
          <summary className="cursor-pointer text-sm font-medium">+ Add Health Plan</summary>
          <SaveForm
            action={createPolicyForContact}
            submitLabel="Add Health Plan"
            savedLabel="Health plan added ✓"
            resetOnSuccess
            primary
            className="mt-3 grid grid-cols-2 gap-3"
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
              <CommissionSelect id="commissionAmount" name="commissionAmount" />
            </div>
            <PolicyField label="Doctor" name="doctor" options={doctorOptions} />
            <PolicyField label="Medical Group" name="medicalGroup" options={groupOptions} />
          </SaveForm>
        </details>
      </section>

      <section>
        <h2 className="section-label mb-3">Client Info</h2>
        <SaveForm action={updateInfoForContact} className="surface grid grid-cols-6 gap-3 p-4">
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
          <div className="col-span-2 flex flex-col gap-1">
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
          <Field label="Email" name="email" type="email" value={contact.email} span={2} />
          <Field label="Address" name="address" value={contact.address} span={3} />
          <Field label="City" name="city" value={contact.city} span={1} />
          <Field label="State" name="state" value={contact.state} span={1} />
          <Field label="ZIP" name="zip" value={contact.zip} span={1} />
          <div className="col-span-2 flex flex-col gap-1">
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
          <div className="col-span-4 flex flex-wrap items-end gap-x-6 gap-y-2 pb-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="medicaid" defaultChecked={contact.medicaid} className="h-4 w-4 accent-indigo-600" />
              Medi-Cal
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="extraHelp" defaultChecked={contact.extraHelp} className="h-4 w-4 accent-indigo-600" />
              Extra Help (LIS)
            </label>
          </div>
          <label className="col-span-6 flex items-center gap-2 text-sm">
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
            <Field label="City" name="mailingCity" value={contact.mailingCity} span={1} />
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
      </section>

      <section>
        <h2 className="section-label mb-1">Contact Person</h2>
        <p className="muted mb-3 text-sm">
          A son, daughter, spouse or caregiver who handles things for this client.
        </p>
        <SaveForm action={updatePersonForContact} className="surface grid grid-cols-6 gap-3 p-4">
          <Field label="Name" name="altContactName" value={contact.altContactName} span={2} />
          <Field
            label="Relationship"
            name="altContactRelationship"
            value={contact.altContactRelationship}
            span={2}
          />
          <Field label="Phone" name="altContactPhone" type="tel" value={contact.altContactPhone} span={2} />
          <Field label="Email" name="altContactEmail" type="email" value={contact.altContactEmail} span={3} />
          <label className="col-span-3 flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="altContactPreferred"
              defaultChecked={contact.altContactPreferred}
              className="h-4 w-4 accent-indigo-600"
            />
            Call this person instead of the client
          </label>
        </SaveForm>
      </section>

      {contact.integrityContactId && (
        <section>
          <h2 className="section-label mb-3">Integrity</h2>
          <div className="surface flex flex-col gap-4 p-4">
            <div className="muted text-sm">
              Linked to Integrity lead #{contact.integrityContactId}
              {contact.integrityLeadStage != null && (
                <>
                  {" "}
                  (
                  {stageMapping
                    ? stageMapping.label
                    : `stage code ${contact.integrityLeadStage} — unmapped`}
                  )
                </>
              )}
              . The button sends the saved Client Info above (address, email,
              phone, Medicare info).
            </div>
            <PushToIntegrityButton contactId={contact.id} />
          </div>
        </section>
      )}

      <section>
        <h2 className="section-label mb-3">Notes</h2>
        <SaveForm
          action={addNoteForContact}
          submitLabel="Add Note"
          savedLabel="Note added ✓"
          resetOnSuccess
          className="mb-4 flex flex-col gap-2"
        >
          <textarea name="body" placeholder="Add a note…" rows={3} required className="field" />
        </SaveForm>

        <div className="flex flex-col gap-2">
          {contact.noteEntries.length === 0 && (
            <p className="muted text-sm">No notes yet.</p>
          )}
          {contact.noteEntries.map((n) => {
            const deleteNoteForContact = deleteContactNote.bind(null, contact.id, n.id);
            return (
              <div
                key={n.id}
                className="surface flex items-start justify-between gap-3 p-3 text-sm"
              >
                <div>
                  <div className="muted text-xs">{formatDateTime(n.createdAt)}</div>
                  <div className="mt-1 whitespace-pre-wrap">{n.body}</div>
                </div>
                <form action={deleteNoteForContact}>
                  <button type="submit" className="btn-danger-text text-xs">
                    Remove
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <section>
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
  );
}

// Grid spans for the 6-column Client Info layout (literal class names so
// Tailwind picks them up).
const SPANS: Record<number, string> = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3" };

function Field({
  label,
  name,
  value,
  type = "text",
  span,
  required = false,
}: {
  label: string;
  name: string;
  value?: string | null;
  type?: string;
  span?: number;
  required?: boolean;
}) {
  // Prefixed so these don't collide with the Add Policy form's ids.
  const id = `info-${name}`;
  return (
    <div className={`flex flex-col gap-1 ${span ? SPANS[span] : ""}`}>
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

type ContactPolicy = Awaited<ReturnType<typeof prisma.policy.findMany>>[number];

function PolicyCard({
  contactId,
  policy: p,
  group,
  effectiveChoices,
  carrierPlans,
}: {
  contactId: string;
  policy: ContactPolicy;
  group: PlanGroup;
  effectiveChoices: { value: string; label: string }[];
  carrierPlans: CarrierPlanOptions;
}) {
  const deletePolicyForContact = deletePolicy.bind(null, contactId, p.id);
  const setEffectiveDate = updatePolicyEffectiveDate.bind(null, contactId, p.id);
  const savePolicy = updatePolicy.bind(null, contactId, p.id);
  const fid = (name: string) => `policy-${p.id}-${name}`;
  const month = p.effectiveDate ? coverageMonth(p.effectiveDate) : null;
  return (
    <div className="surface flex items-start justify-between gap-3 p-3 text-sm">
      <div>
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {p.carrier} — {p.planName} {p.planType && `(${p.planType})`}
          {p.clientType && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {p.clientType === "new" ? "New client" : "Current client"}
            </span>
          )}
          {group === "current" && p.effectiveDate && month !== null && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              Month {month}
            </span>
          )}
        </div>
        <div className="muted mt-1 flex flex-wrap gap-4">
          {group !== "future" && p.effectiveDate && <span>Effective {formatDateOnly(p.effectiveDate)}</span>}
          {p.submittedAt && <span>Submitted {formatDateOnly(p.submittedAt)}</span>}
          {p.termDate && <span>{group === "previous" ? "Ended" : "Ends"} {formatDateOnly(p.termDate)}</span>}
          {p.policyNumber && <span>Policy #{p.policyNumber}</span>}
          {p.commissionAmount != null && <span>Commission ${p.commissionAmount.toFixed(2)}</span>}
          {p.doctor && <span>{/^dr\.?\s/i.test(p.doctor) ? p.doctor : `Dr. ${p.doctor}`}</span>}
          {p.medicalGroup && <span>{p.medicalGroup}</span>}
        </div>
        <details className="mt-2">
          <summary className="link cursor-pointer text-xs">Edit details</summary>
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
                initialCarrier={p.carrier}
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
          </SaveForm>
        </details>
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
      </div>
      <div className="flex items-center gap-3">
        <form action={deletePolicyForContact}>
          <button type="submit" className="btn-danger-text text-xs">
            Remove
          </button>
        </form>
      </div>
    </div>
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
