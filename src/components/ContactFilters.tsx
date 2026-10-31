"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DropdownMenu } from "@/components/DropdownMenu";

type Option = { value: string; label: string };

// Search and Stage up front; Source, Medi-Cal / Extra Help, County and
// Effective month in a Filters menu. The list updates as soon as anything
// changes (search after a short pause), with no Filter button.
export function ContactFilters({
  stages,
  sources,
  counties,
}: {
  stages: Option[];
  sources: Option[];
  counties: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Search: wait until typing pauses.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update("q", q.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const moreCount = ["source", "flag", "county", "eff"].filter((k) => params.get(k)).length;
  const select = (key: string, label: string, options: Option[]) => (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {label}
      <select value={params.get(key) ?? ""} onChange={(e) => update(key, e.target.value)} className="field">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, email, or phone"
        aria-label="Search contacts"
        className="field min-w-64 flex-1"
      />
      <select
        value={params.get("stage") ?? ""}
        onChange={(e) => update("stage", e.target.value)}
        aria-label="Stage"
        className="field"
      >
        <option value="">All stages</option>
        {stages.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <DropdownMenu label={moreCount ? `Filters (${moreCount})` : "Filters"}>
        <div className="flex w-64 flex-col gap-3 p-2">
          {select("source", "Source", [{ value: "", label: "All sources" }, { value: "website", label: "Website leads" }, { value: "none", label: "No source" }, ...sources])}
          {select("flag", "Medi-Cal / Extra Help", [
            { value: "", label: "Any" },
            { value: "either", label: "Medi-Cal or Extra Help" },
            { value: "medicaid", label: "Medi-Cal" },
            { value: "extraHelp", label: "Extra Help" },
          ])}
          {select("county", "County", [{ value: "", label: "All counties" }, ...counties.map((c) => ({ value: c, label: c }))])}
          <label className="flex flex-col gap-1 text-xs font-medium">
            Plan effective in
            <input
              type="month"
              value={params.get("eff") ?? ""}
              onChange={(e) => update("eff", e.target.value)}
              className="field"
            />
          </label>
        </div>
      </DropdownMenu>
    </div>
  );
}
