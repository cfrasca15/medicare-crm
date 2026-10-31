// Pick a usual lead source, or type a new one (e.g. "Senior Expo 2026").
export function LeadSourceField({
  id,
  value,
  options,
  className = "",
}: {
  id: string;
  value?: string | null;
  options: string[];
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium" htmlFor={id}>
        Lead Source
      </label>
      <input
        id={id}
        name="leadSource"
        list="lead-source-options"
        defaultValue={value ?? ""}
        placeholder="Pick or type one"
        autoComplete="off"
        className="field"
      />
      <datalist id="lead-source-options">
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
