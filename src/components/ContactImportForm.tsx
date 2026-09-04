"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewContactImport,
  applyContactImport,
  type ImportRowResult,
} from "@/lib/actions/bulkImport";

export function ContactImportForm() {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ImportRowResult[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    updated: number;
    pushResults: { name: string; ok: boolean; error?: string }[];
  } | null>(null);
  const router = useRouter();

  function handleFile(file: File) {
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      startTransition(async () => {
        try {
          const preview = await previewContactImport(text);
          setRows(preview.rows);
          setSelected(
            new Set(
              preview.rows
                .filter(
                  (r) =>
                    r.status === "matched" &&
                    r.identityWarnings.length === 0 &&
                    r.changes.length > 0
                )
                .map((r) => r.rowNumber)
            )
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to read file.");
        }
      });
    };
    reader.readAsText(file);
  }

  function toggle(rowNumber: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function apply() {
    if (!rows) return;
    const toApply = rows
      .filter((r) => selected.has(r.rowNumber) && r.matchedContactId)
      .map((r) => ({ contactId: r.matchedContactId as string, updates: r.updates }));
    if (toApply.length === 0) return;

    startTransition(async () => {
      try {
        const res = await applyContactImport(toApply);
        setResult(res);
        setRows(null);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Apply failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <p className="muted mt-2 text-xs">
          Columns recognized: Integrity Lead ID, First Name, Last Name, Email,
          Phone, Address, City, State, ZIP, Date of Birth, Insurance Company,
          Plan Name, Medicare ID, Part A Effective, Part B Effective, Doctor,
          Medical Group. A row is matched by Lead ID first, then Email, then
          Name — export contacts to CSV first for the most reliable Lead ID
          matching. Blank cells never
          clear an existing value.
        </p>
      </div>

      {isPending && <p className="muted text-sm">Working…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="surface p-3 text-sm">
          <p className="font-medium">Updated {result.updated} contact(s).</p>
          {result.pushResults.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {result.pushResults.map((p, i) => (
                <li
                  key={i}
                  className={p.ok ? "muted" : "text-red-600 dark:text-red-400"}
                >
                  {p.name}: {p.ok ? "pushed to Integrity" : `push failed — ${p.error}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="muted text-sm">
              {rows.length} row(s) — {selected.size} selected
            </p>
            <button
              type="button"
              disabled={isPending || selected.size === 0}
              onClick={apply}
              className="btn-primary"
            >
              Apply Selected ({selected.size})
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <ImportRow
                key={row.rowNumber}
                row={row}
                checked={selected.has(row.rowNumber)}
                onToggle={() => toggle(row.rowNumber)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImportRow({
  row,
  checked,
  onToggle,
}: {
  row: ImportRowResult;
  checked: boolean;
  onToggle: () => void;
}) {
  const canSelect = row.status === "matched" && row.changes.length > 0;

  return (
    <div className="surface flex items-start gap-3 p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={!canSelect}
        onChange={onToggle}
        className="mt-1"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            Row {row.rowNumber}: {row.matchedContactName ?? row.rowLabel}
          </span>
          {row.matchedBy && (
            <span className="muted text-xs">matched by {row.matchedBy}</span>
          )}
          {row.status === "ambiguous" && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              ambiguous match — skipped
            </span>
          )}
          {row.status === "not_found" && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              no match found — skipped
            </span>
          )}
        </div>

        {row.identityWarnings.map((w, i) => (
          <p key={i} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {w}
          </p>
        ))}

        {row.status === "matched" && row.changes.length === 0 && (
          <p className="muted mt-1 text-xs">No changes.</p>
        )}

        {row.changes.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {row.changes.map((c, i) => (
              <li key={i} className="muted text-xs">
                {c.label}: <span className="line-through">{c.oldValue}</span>{" "}
                → <span className="font-medium">{c.newValue}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
