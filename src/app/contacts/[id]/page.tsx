import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StageSelect } from "@/components/StageSelect";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { createPolicy, deletePolicy } from "@/lib/actions/policies";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import {
  updateContactNotes,
  updateContactDoctorInfo,
  deleteContact,
} from "@/lib/actions/contacts";
import { PushAddressForm } from "@/components/PushAddressForm";
import { PushEmailPhoneForm } from "@/components/PushEmailPhoneForm";
import { HealthProfilePanel } from "@/components/HealthProfilePanel";
import { formatDateOnly } from "@/lib/date";
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
    },
  });

  if (!contact) notFound();

  const stageMapping =
    contact.integrityLeadStage != null
      ? await prisma.integrityStageMapping.findUnique({
          where: { code: contact.integrityLeadStage },
        })
      : null;

  const createPolicyForContact = createPolicy.bind(null, contact.id);
  const updateNotesForContact = updateContactNotes.bind(null, contact.id);
  const updateDoctorInfoForContact = updateContactDoctorInfo.bind(null, contact.id);
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
        <InfoRow label="Medicare ID" value={contact.medicareId} />
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
        <form action={updateNotesForContact} className="flex flex-col gap-2">
          <textarea name="notes" defaultValue={contact.notes ?? ""} rows={4} className="field" />
          <div>
            <button type="submit" className="btn-secondary">
              Save Notes
            </button>
          </div>
        </form>
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
