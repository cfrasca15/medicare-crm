"use client";

import { useMemo, useState, useTransition } from "react";
import {
  applyStatement,
  matchStatement,
  readStatement,
  type LineMatch,
  type PolicyOption,
  type ReadStatementResult,
} from "@/lib/actions/commissions";
import { readLines, STATEMENT_FIELDS, type StatementField, type StatementMapping } from "@/lib/commissionStatement";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const shortDate = (s: string | null) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return `${m}/${d}/${y}`;
};

// Upload a carrier commission statement, check which client each line goes
// to, then apply it to their plans' commission received.
export function CommissionImport({ carriers }: { carriers: string[] }) {
  const [file, setFile] = useState<Required<Omit<ReadStatementResult, "error" | "carrier">> | null>(null);
  const [carrier, setCarrier] = useState("");
  const [mapping, setMapping] = useState<StatementMapping>({});
  const [headerRow, setHeaderRow] = useState(0);
  const [result, setResult] = useState<{ matches: LineMatch[]; options: PolicyOption[] } | null>(null);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const headers = file ? file.rows[headerRow] ?? [] : [];
  const lines = useMemo(() => (file ? readLines(file.rows, headerRow, mapping) : []), [file, headerRow, mapping]);
  const optionLabel = useMemo(() => new Map(result?.options.map((o) => [o.policyId, o.label]) ?? []), [result]);

  const reset = () => {
    setFile(null);
    setResult(null);
    setChosen({});
    setTicked(new Set());
    setEditing(new Set());
  };

  const runMatch = (c: string) => {
    if (!c) return;
    startTransition(async () => {
      const r = await matchStatement(c, lines);
      setResult(r);
      setChosen(Object.fromEntries(r.matches.map((m, i) => [i, m.policyId ?? ""])));
      // Sure matches start ticked; guesses wait for a look.
      setTicked(new Set(r.matches.flatMap((m, i) => (m.confidence === "sure" && m.policyId && !m.alreadyImported ? [i] : []))));
      setEditing(new Set());
    });
  };

  const changeSetup = (fn: () => void) => {
    fn();
    setResult(null);
  };

  if (!file) {
    return (
      <form
        action={(fd) =>
          startTransition(async () => {
            setMessage(null);
            const r = await readStatement(fd);
            if (r.error || !r.rows) return setMessage({ kind: "error", text: r.error ?? "Couldn't read that file." });
            setFile({ fileName: r.fileName!, rows: r.rows, headerRow: r.headerRow!, mapping: r.mapping! });
            setHeaderRow(r.headerRow!);
            setMapping(r.mapping!);
            setCarrier(r.carrier ?? "");
            setResult(null);
            if (r.carrier) {
              const found = readLines(r.rows, r.headerRow!, r.mapping!);
              const m = await matchStatement(r.carrier, found);
              setResult(m);
              setChosen(Object.fromEntries(m.matches.map((x, i) => [i, x.policyId ?? ""])));
              setTicked(new Set(m.matches.flatMap((x, i) => (x.confidence === "sure" && x.policyId && !x.alreadyImported ? [i] : []))));
            }
          })
        }
        className="surface flex flex-col gap-3 p-4"
      >
        <h2 className="text-sm font-medium">Upload a statement</h2>
        <p className="muted text-sm">
          Download the commission statement from the carrier&apos;s agent portal as Excel (.xlsx) or CSV and
          upload it here. You&apos;ll see which client each line matches before anything is saved.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" name="file" accept=".csv,.xlsx,.xls,.txt,.pdf" required className="text-sm" />
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Reading…" : "Read statement"}
          </button>
        </div>
        {message && (
          <p className={`text-sm ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {message.text}
          </p>
        )}
      </form>
    );
  }

  const counts = result
    ? {
        sure: result.matches.filter((m) => m.confidence === "sure" && !m.alreadyImported).length,
        check: result.matches.filter((m) => m.confidence === "check" && !m.alreadyImported).length,
        none: result.matches.filter((m) => m.confidence === "none" && !m.alreadyImported).length,
        done: result.matches.filter((m) => m.alreadyImported).length,
      }
    : null;
  const toApply = [...ticked].filter((i) => chosen[i] && !result?.matches[i]?.alreadyImported);
  const applyTotal = toApply.reduce((s, i) => s + lines[i].amount, 0);
  const fileTotal = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="surface flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">{file.fileName}</h2>
            <p className="muted text-xs">
              {lines.length} payment {lines.length === 1 ? "line" : "lines"} · {money(fileTotal)}
            </p>
          </div>
          <button type="button" onClick={reset} className="btn-secondary">
            Choose a different file
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Carrier
            <select
              value={carrier}
              onChange={(e) => changeSetup(() => setCarrier(e.target.value))}
              className="field"
            >
              <option value="">Pick the carrier…</option>
              {carriers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 max-w-full flex-col gap-1 text-xs font-medium">
            Column names are on row
            <select
              value={headerRow}
              onChange={(e) => {
                const r = Number(e.target.value);
                changeSetup(() => {
                  setHeaderRow(r);
                  setMapping({});
                });
              }}
              className="field max-w-full"
            >
              {file.rows.slice(0, 25).map((r, i) => (
                <option key={i} value={i}>
                  {i + 1}: {r.filter(Boolean).slice(0, 3).join(", ").slice(0, 40) || "(blank)"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <details open={!result}>
          <summary className="link cursor-pointer text-sm">Columns</summary>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STATEMENT_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-xs font-medium">
                {f.label}
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    changeSetup(() =>
                      setMapping((m) => {
                        const next = { ...m };
                        if (v === "") delete next[f.key as StatementField];
                        else next[f.key as StatementField] = Number(v);
                        return next;
                      })
                    );
                  }}
                  className="field"
                >
                  <option value="">Not in this file</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="muted mt-2 text-xs">
            Needs the amount plus the member&apos;s name (full or first and last) or member ID / policy number.
            These choices are remembered for the next statement in this layout.
          </p>
        </details>

        {!result && (
          <div>
            <button
              type="button"
              disabled={isPending || !carrier || mapping.amount == null || lines.length === 0}
              onClick={() => runMatch(carrier)}
              className="btn-primary"
            >
              {isPending ? "Matching…" : "Match to clients"}
            </button>
            {mapping.amount == null && <span className="muted ml-3 text-sm">Pick the commission amount column.</span>}
          </div>
        )}
      </div>

      {result && counts && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {counts.sure} matched
            </span>
            {counts.check > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                {counts.check} to check
              </span>
            )}
            {counts.none > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                {counts.none} not found
              </span>
            )}
            {counts.done > 0 && (
              <span className="muted rounded-full bg-slate-100 px-2.5 py-0.5 dark:bg-slate-800">{counts.done} already imported</span>
            )}
          </div>

          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">On the statement</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Client &amp; plan</th>
                </tr>
              </thead>
              <tbody>
                {result.matches.map((m, i) => {
                  const l = lines[i];
                  if (!l) return null;
                  const tone = m.alreadyImported
                    ? "muted"
                    : m.confidence === "sure"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : m.confidence === "check"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-red-600 dark:text-red-400";
                  const showPicker = !m.alreadyImported && (editing.has(i) || m.confidence !== "sure" || !chosen[i]);
                  return (
                    <tr key={i} className={`border-t border-slate-200 align-top dark:border-slate-800 ${m.alreadyImported ? "opacity-60" : ""}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={m.alreadyImported || !chosen[i]}
                          checked={ticked.has(i) && !!chosen[i] && !m.alreadyImported}
                          onChange={(e) => {
                            const next = new Set(ticked);
                            if (e.target.checked) next.add(i);
                            else next.delete(i);
                            setTicked(next);
                          }}
                          aria-label={`Apply ${l.memberName}`}
                          className="h-4 w-4 accent-indigo-600"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.memberName}</div>
                        <div className="muted text-xs">
                          {[l.memberId, l.paidOn && `paid ${shortDate(l.paidOn)}`, l.plan, l.description].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${l.amount < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                        {money(l.amount)}
                      </td>
                      <td className="px-3 py-2">
                        {showPicker ? (
                          <select
                            value={chosen[i] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setChosen((c) => ({ ...c, [i]: v }));
                              const next = new Set(ticked);
                              if (v) next.add(i);
                              else next.delete(i);
                              setTicked(next);
                            }}
                            className="field w-full max-w-md min-w-[14rem]"
                          >
                            <option value="">Skip this line</option>
                            {result.options.map((o) => (
                              <option key={o.policyId} value={o.policyId}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{optionLabel.get(chosen[i]) ?? "—"}</span>
                            {!m.alreadyImported && (
                              <button
                                type="button"
                                onClick={() => setEditing((s) => new Set(s).add(i))}
                                className="link text-xs"
                              >
                                Change
                              </button>
                            )}
                          </div>
                        )}
                        <div className={`mt-1 text-xs ${tone}`}>{m.alreadyImported ? "Already imported" : m.reason}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isPending || toApply.length === 0}
              onClick={() =>
                startTransition(async () => {
                  const r = await applyStatement({
                    carrier,
                    fileName: file.fileName,
                    headers,
                    mapping,
                    lines: toApply.map((i) => ({
                      policyId: chosen[i],
                      lineKey: result.matches[i].lineKey,
                      memberName: lines[i].memberName,
                      memberId: lines[i].memberId,
                      amount: lines[i].amount,
                      paidOn: lines[i].paidOn,
                      description: [lines[i].description, lines[i].plan].filter(Boolean).join(" · ") || null,
                    })),
                  });
                  if (r.error) return setMessage({ kind: "error", text: r.error });
                  reset();
                  setMessage({
                    kind: "ok",
                    text: `Applied ${r.applied} ${r.applied === 1 ? "line" : "lines"} (${money(r.total ?? 0)}) to your clients' plans.`,
                  });
                })
              }
              className="btn-primary"
            >
              {isPending ? "Saving…" : `Apply ${toApply.length} ${toApply.length === 1 ? "line" : "lines"} (${money(applyTotal)})`}
            </button>
            <span className="muted text-sm">Unticked lines are skipped. Uploading the same file again skips lines already applied.</span>
          </div>
          {message && (
            <p className={`text-sm ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
