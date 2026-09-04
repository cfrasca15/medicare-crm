import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StageSelect } from "@/components/StageSelect";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { createPolicy, deletePolicy } from "@/lib/actions/policies";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import {
  addContactNote,
  deleteContactNote,
  updateContactPlanInfo,
  updateContactDoctorInfo,
  updateContactMedicareInfo,
  deleteContact,
} from "@/lib/actions/contacts";
import { PushAddressForm } from "@/components/PushAddressForm";
import { PushEmailPhoneForm } from "@/components/PushEmailPhoneForm";
import { PushMedicareInfoForm } from "@/components/PushMedicareInfoForm";
import { HealthProfilePanel } from "@/components/HealthProfilePanel";
import { EmailPanel } from "@/components/EmailPanel";
import { getGoogleAccount, listGmailMessagesForContact, type GmailMessageSummary } from "@/lib/google";
import { formatDateOnly, formatDateTime, dateInputValue } from "@/lib/date";
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
      providers: { orderBy: { createdAt: "desc" } },
      pharmacies: { orderBy: { createdAt: "desc" } },
      prescriptions: { orderBy: { createdAt: "desc" } },
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
  const updatePlanInfoForContact = updateContactPlanInfo.bind(null, contact.id);
  const updateDoctorInfoForContact = updateContactDoctorInfo.bind(null, contact.id);
  const updateMedicareInfoForContact = updateContactMedicareInfo.bind(null, contact.id);
  const deleteContactBound = deleteContact.bind(null, contact.id);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/contacts" className="link text-sm">
            ← All contacts
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {contact.firstName} {contact.lastName}
          </h1>
          <div className="muted mt-1 flex items-center gap-4 text-sm">
            {contact.phone && (
              <span className="flex items-center gap-2">
                {contact.phone}
                <CallButton phone={contact.phone} />
              </span>
            )}
            {contact.email && <span>{contact.email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StageSelect contactId={contact.id} stage={contact.stage} />
          <form action={deleteContactBound}>
            <button type="submit" className="btn-danger-text text-sm">
              Delete
            </button>
          </form>
        </div>
      </div>

      <section className="surface grid grid-cols-2 gap-x-8 gap-y-2 p-4 text-sm">
        <InfoRow label="Address" value={contact.address} />
        <InfoRow label="City / State / ZIP" value={[contact.city, contact.state, contact.zip].filter(Boolean).join(", ")} />
        <InfoRow label="Date of birth" value={contact.dateOfBirth ? formatDateOnly(contact.dateOfBirth) : undefined} />
      </section>

      <section>
        <h2 className="section-label mb-3">Plan / Insurance Company</h2>
        <p className="muted -mt-2 mb-3 text-sm">
          The plan being considered for this prospect — separate from a
          policy&apos;s own carrier/plan name, which records what was
          actually sold.
        </p>
        <form action={updatePlanInfoForContact} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="insuranceCompany">
              Insurance Company
            </label>
            <input
              id="insuranceCompany"
              name="insuranceCompany"
              defaultValue={contact.insuranceCompany ?? ""}
              className="field"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="planName">
              Plan Name
            </label>
            <input
              id="planName"
              name="planName"
              defaultValue={contact.planName ?? ""}
              className="field"
            />
          </div>
          <div className="col-span-2">
            <button type="submit" className="btn-secondary">
              Save
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="section-label mb-3">Medicare Info</h2>
        <form action={updateMedicareInfoForContact} className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="medicareId">
              Medicare Number
            </label>
            <input
              id="medicareId"
              name="medicareId"
              defaultValue={contact.medicareId ?? ""}
              className="field"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="partAEffectiveDate">
              Part A Effective
            </label>
            <input
              id="partAEffectiveDate"
              name="partAEffectiveDate"
              type="date"
              defaultValue={
                contact.partAEffectiveDate ? dateInputValue(contact.partAEffectiveDate) : ""
              }
              className="field"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="partBEffectiveDate">
              Part B Effective
            </label>
            <input
              id="partBEffectiveDate"
              name="partBEffectiveDate"
              type="date"
              defaultValue={
                contact.partBEffectiveDate ? dateInputValue(contact.partBEffectiveDate) : ""
              }
              className="field"
            />
          </div>
          <div className="col-span-3">
            <button type="submit" className="btn-secondary">
              Save
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="section-label mb-3">Doctor / Medical Group</h2>
        <p className="muted -mt-2 mb-3 text-sm">
          Worth confirming this is in-network before selling a policy — this
          is separate from a policy&apos;s own doctor/medical group, which
          records what was actually verified for the plan sold.
        </p>
        <form action={updateDoctorInfoForContact} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="doctor">
              Doctor
            </label>
            <input
              id="doctor"
              name="doctor"
              defaultValue={contact.doctor ?? ""}
              className="field"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="medicalGroup">
              Medical Group
            </label>
            <input
              id="medicalGroup"
              name="medicalGroup"
              defaultValue={contact.medicalGroup ?? ""}
              className="field"
            />
          </div>
          <div className="col-span-2">
            <button type="submit" className="btn-secondary">
              Save
            </button>
          </div>
        </form>
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
            </div>
            <PushAddressForm
              contactId={contact.id}
              defaultAddress1={contact.address ?? undefined}
              defaultCity={contact.city ?? undefined}
              defaultStateCode={contact.state ?? undefined}
              defaultPostalCode={contact.zip ?? undefined}
            />
            <PushEmailPhoneForm
              contactId={contact.id}
              defaultEmail={contact.email ?? undefined}
              defaultPhone={contact.phone ?? undefined}
            />
            <PushMedicareInfoForm
              contactId={contact.id}
              defaultMedicareId={contact.medicareId ?? undefined}
              defaultPartADate={
                contact.partAEffectiveDate ? dateInputValue(contact.partAEffectiveDate) : undefined
              }
              defaultPartBDate={
                contact.partBEffectiveDate ? dateInputValue(contact.partBEffectiveDate) : undefined
              }
            />
            <div>
              <h3 className="mb-2 text-sm font-medium">Health Profile</h3>
              <HealthProfilePanel
                contactId={contact.id}
                providers={contact.providers}
                pharmacies={contact.pharmacies}
                prescriptions={contact.prescriptions}
              />
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="section-label mb-3">Notes</h2>
        <form action={addNoteForContact} className="mb-4 flex flex-col gap-2">
          <textarea name="body" placeholder="Add a note…" rows={3} required className="field" />
          <div>
            <button type="submit" className="btn-secondary">
              Add Note
            </button>
          </div>
        </form>

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
            return (
              <div key={p.id} className="surface flex items-start justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">
                    {p.carrier} — {p.planName} {p.planType && `(${p.planType})`}
                  </div>
                  <div className="muted mt-1 flex flex-wrap gap-4">
                    {p.policyNumber && <span>Policy #{p.policyNumber}</span>}
                    {p.effectiveDate && (
                      <span>Effective {formatDateOnly(p.effectiveDate)}</span>
                    )}
                    {p.commissionStatus && <span>Commission: {p.commissionStatus}</span>}
                    {p.commissionAmount != null && (
                      <span>${p.commissionAmount.toFixed(2)}</span>
                    )}
                    {p.doctor && <span>Dr. {p.doctor}</span>}
                    {p.medicalGroup && <span>{p.medicalGroup}</span>}
                  </div>
                </div>
                <form action={deletePolicyForContact}>
                  <button type="submit" className="btn-danger-text text-xs">
                    Remove
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        <details className="surface p-3">
          <summary className="cursor-pointer text-sm font-medium">+ Add Policy</summary>
          <form action={createPolicyForContact} className="mt-3 grid grid-cols-2 gap-3">
            <PolicyField label="Carrier" name="carrier" required />
            <PolicyField label="Plan Name" name="planName" required />
            <PolicyField label="Plan Type" name="planType" placeholder="MAPD, PDP, Med Supp..." />
            <PolicyField label="Policy Number" name="policyNumber" />
            <PolicyField label="Effective Date" name="effectiveDate" type="date" />
            <PolicyField label="Commission Status" name="commissionStatus" placeholder="pending, paid..." />
            <PolicyField label="Commission Amount" name="commissionAmount" type="number" />
            <PolicyField label="Annual Premium" name="annualPremium" type="number" />
            <PolicyField label="Doctor" name="doctor" />
            <PolicyField label="Medical Group" name="medicalGroup" />
            <div className="col-span-2">
              <button type="submit" className="btn-primary">
                Add Policy
              </button>
            </div>
          </form>
        </details>
      </section>

      <section>
        <h2 className="section-label mb-3">Tasks</h2>
        <div className="mb-4 flex flex-col gap-2">
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

        <details className="surface p-3">
          <summary className="cursor-pointer text-sm font-medium">+ Add Task</summary>
          <form action={createTask} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="contactId" value={contact.id} />
            <input name="title" placeholder="Task title" required className="field" />
            <input name="dueDate" type="date" className="field" />
            <textarea name="notes" placeholder="Notes" rows={2} className="field" />
            <div>
              <button type="submit" className="btn-primary">
                Add Task
              </button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="muted">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function PolicyField({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
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
        className="field"
      />
    </div>
  );
}
