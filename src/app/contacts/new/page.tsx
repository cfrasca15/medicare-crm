import { createContact } from "@/lib/actions/contacts";

export default function NewContactPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New Contact</h1>

      <form action={createContact} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" name="firstName" required />
          <Field label="Last name" name="lastName" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone" name="phone" type="tel" />
          <Field label="Email" name="email" type="email" />
        </div>
        <Field label="Address" name="address" />
        <div className="grid grid-cols-3 gap-4">
          <Field label="City" name="city" />
          <Field label="State" name="state" />
          <Field label="ZIP" name="zip" />
        </div>
        <Field label="Date of birth" name="dateOfBirth" type="date" />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Medicare Number" name="medicareId" />
          <Field label="Part A Effective" name="partAEffectiveDate" type="date" />
          <Field label="Part B Effective" name="partBEffectiveDate" type="date" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Doctor" name="doctor" />
          <Field label="Medical Group" name="medicalGroup" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea name="notes" rows={3} className="field" />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <button type="submit" className="btn-primary">
            Save Contact
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input id={name} name={name} type={type} required={required} className="field" />
    </div>
  );
}
