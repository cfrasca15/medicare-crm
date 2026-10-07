import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StageSelect } from "@/components/StageSelect";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { createPolicy, deletePolicy, updatePolicyEffectiveDate } from "@/lib/actions/policies";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import {
  addContactNote,
  deleteContactNote,
  updateContactInfo,
  updateContactProspectInfo,
  updateContactPerson,
  deleteContact,
} from "@/lib/actions/contacts";
import { SaveForm } from "@/components/SaveForm";
import { PushToIntegrityButton } from "@/components/PushToIntegrityButton";
import { DeleteContactButton } from "@/components/DeleteContactButton";
import { EmailPanel } from "@/components/EmailPanel";
import { getGoogleAccount, listGmailMessagesForContact, type GmailMessageSummary } from "@/lib/google";
import { formatDateOnly, formatDateTime, dateInputValue } from "@/lib/date";
import { coverageLabel, coverageMonth, currentPolicy } from "@/lib/coverage";
import { CARRIER_SEED, PLAN_TYPE_SEED } from "@/lib/constants";
import { CallButton } from "@/components/CallButton";
import { CalendarSyncButton } from "@/components/CalendarSyncButton";

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

  const [carrierRows, planNameRows, planTypeRows] = await Promise.all([
    prisma.policy.findMany({ distinct: ["carrier"], select: { carrier: true }, orderBy: { carrier: "asc" } }),
    prisma.policy.findMany({ distinct: ["planName"], select: { planName: true }, orderBy: { planName: "asc" } }),
    prisma.policy.findMany({
      distinct: ["planType"],
      select: { planType: true },
      where: { planType: { not: null } },
      orderBy: { planType: "asc" },
    }),
  ]);
  const carrierOptions = Array.from(
    new Set([...CARRIER_SEED, ...carrierRows.map((r) => r.carrier)])
  ).sort();
  const planNameOptions = Array.from(new Set(planNameRows.map((r) => r.planName))).sort();
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
  const updateProspectForContact = updateContactProspectInfo.bind(null, contact.id);
  const updatePersonForContact = updateContactPerson.bind(null, contact.id);
  const deleteContactBound = deleteContact.bind(null, contact.id);
  const tracked = currentPolicy(contact.policies);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/contacts" className="link text-sm">
            ← All contacts
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {contact.firstName} {contact.lastName}
          </h1>
          <div className="muted mt-1 flex flex-wrap items-center gap-4 text-sm">
            {contact.phone && (
              <span className="flex items-center gap-2">
                {contact.phone}
                <CallButton phone={contact.phone} />
              </span>
            )}
            {contact.email && <span>{contact.email}</span>}
            {(contact.leadSource || contact.lastWebsiteLeadAt) && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-200">
                {contact.leadSource ?? "Website: returning contact"}
                {contact.lastWebsiteLeadAt
                  ? ` · latest ${contact.lastWebsiteLeadAt.toLocaleDateString("en-US")}`
                  : ""}
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
          {tracked?.effectiveDate && (
            <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              {coverageLabel(tracked.effectiveDate)}
              <span className="font-normal opacity-80">
                — {tracked.carrier} {tracked.planName}
              </span>
            </div>
          )}
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
        <h2 className="section-label mb-3">Client Info</h2>
        <SaveForm action={updateInfoForContact} className="surface grid grid-cols-6 gap-3 p-4">
          <Field label="First Name" name="firstName" value={contact.firstName} span={3} required />
          <Field label="Last Name" name="lastName" value={contact.lastName} span={3} required />
          <Field label="Phone" name="phone" type="tel" value={contact.phone} span={2} />
          <Field label="Email" name="email" type="email" value={contact.email} span={2} />
          <Field
            label="Date of Birth"
            name="dateOfBirth"
            type="date"
            value={contact.dateOfBirth ? dateInputValue(contact.dateOfBirth) : null}
            span={2}
          />
          <Field label="Address" name="address" value={contact.address} span={3} />
          <Field label="City" name="city" value={contact.city} span={1} />
          <Field label="State" name="state" value={contact.state} span={1} />
          <Field label="ZIP" name="zip" value={contact.zip} span={1} />
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

      <section>
        <h2 className="section-label mb-1">Shopping For</h2>
        <p className="muted mb-3 text-sm">
          The plan and doctor being considered before enrolling. What was
          actually sold is recorded on the policy below.
        </p>
        <SaveForm action={updateProspectForContact} className="surface grid grid-cols-2 gap-3 p-4">
          <Field label="Insurance Company" name="insuranceCompany" value={contact.insuranceCompany} />
          <Field label="Plan Name" name="planName" value={contact.planName} />
          <Field label="Doctor" name="doctor" value={contact.doctor} />
          <Field label="Medical Group" name="medicalGroup" value={contact.medicalGroup} />
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

      <section>
        <h2 className="section-label mb-3">Policies</h2>
        <div className="mb-4 flex flex-col gap-3">
          {contact.policies.length === 0 && (
            <p className="muted text-sm">No policies yet.</p>
          )}
          {contact.policies.map((p) => {
            const deletePolicyForContact = deletePolicy.bind(null, contact.id, p.id);
            const setEffectiveDate = updatePolicyEffectiveDate.bind(null, contact.id, p.id);
            const month = p.effectiveDate ? coverageMonth(p.effectiveDate) : null;
            return (
              <div key={p.id} className="surface flex items-start justify-between p-3 text-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {p.carrier} — {p.planName} {p.planType && `(${p.planType})`}
                    {p.effectiveDate && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        {month === null ? "Not started yet" : `Month ${month}`}
                      </span>
                    )}
                  </div>
                  <div className="muted mt-1 flex flex-wrap gap-4">
                    {p.policyNumber && <span>Policy #{p.policyNumber}</span>}
                    {p.commissionStatus && <span>Commission: {p.commissionStatus}</span>}
                    {p.commissionAmount != null && (
                      <span>${p.commissionAmount.toFixed(2)}</span>
                    )}
                    {p.doctor && <span>Dr. {p.doctor}</span>}
                    {p.medicalGroup && <span>{p.medicalGroup}</span>}
                  </div>
                  <SaveForm action={setEffectiveDate} className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      Effective date
                      <input
                        type="date"
                        name="effectiveDate"
                        defaultValue={p.effectiveDate ? dateInputValue(p.effectiveDate) : ""}
                        className="field"
                      />
                    </label>
                  </SaveForm>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/documents?carrier=${encodeURIComponent(p.carrier)}&planName=${encodeURIComponent(p.planName)}`}
                    className="link text-xs"
                  >
                    Docs
                  </Link>
                  <form action={deletePolicyForContact}>
                    <button type="submit" className="btn-danger-text text-xs">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>

        <details className="surface p-3">
          <summary className="cursor-pointer text-sm font-medium">+ Add Policy</summary>
          <SaveForm
            action={createPolicyForContact}
            submitLabel="Add Policy"
            savedLabel="Policy added ✓"
            resetOnSuccess
            primary
            className="mt-3 grid grid-cols-2 gap-3"
          >
            <PolicyField label="Carrier" name="carrier" required options={carrierOptions} />
            <PolicyField label="Plan Name" name="planName" required options={planNameOptions} />
            <PolicyField
              label="Plan Type"
              name="planType"
              placeholder="MAPD, PDP, Med Supp..."
              options={planTypeOptions}
            />
            <PolicyField label="Policy Number" name="policyNumber" />
            <PolicyField label="Effective Date" name="effectiveDate" type="date" />
            <PolicyField label="Commission Status" name="commissionStatus" placeholder="pending, paid..." />
            <PolicyField label="Commission Amount" name="commissionAmount" type="number" />
            <PolicyField label="Annual Premium" name="annualPremium" type="number" />
            <PolicyField label="Doctor" name="doctor" />
            <PolicyField label="Medical Group" name="medicalGroup" />
          </SaveForm>
        </details>
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
