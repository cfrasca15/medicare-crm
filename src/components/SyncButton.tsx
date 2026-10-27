"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { syncIntegrityLeads, type SyncResult } from "@/lib/actions/integritySync";
import { Toast } from "@/components/Toast";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sync?: SyncResult; error?: string } | null>(null);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            try {
              setResult({ sync: await syncIntegrityLeads() });
              router.refresh();
            } catch (err) {
              setResult({ error: err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed." });
            }
          });
        }}
        className="btn-secondary"
      >
        {isPending ? "Syncing…" : "Sync from Integrity"}
      </button>
      {result && (
        <Toast
          message={result.sync ? <SyncSummary r={result.sync} onNavigate={() => setResult(null)} /> : result.error}
          error={!!result.error}
          stay
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}

// What the sync changed, by name, so it's clear something happened.
function SyncSummary({ r, onNavigate }: { r: SyncResult; onNavigate: () => void }) {
  const total = r.imported.length + r.moved.length + r.changed.length + r.unchanged;
  const nothing = !r.imported.length && !r.moved.length && !r.changed.length;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium">
        Synced {total} contact{total === 1 ? "" : "s"} from Integrity
      </div>
      {nothing ? (
        <div className="muted">Everything already matched Integrity.</div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {r.imported.length > 0 && (
            <li>
              <span className="font-medium">{r.imported.length} new:</span>{" "}
              <Names items={r.imported} onNavigate={onNavigate} />
            </li>
          )}
          {r.moved.length > 0 && (
            <li>
              <span className="font-medium">{r.moved.length} moved stage:</span>{" "}
              <Names items={r.moved} note={(m) => `→ ${m.to}`} onNavigate={onNavigate} />
            </li>
          )}
          {r.changed.length > 0 && (
            <li>
              <span className="font-medium">{r.changed.length} with new details:</span>{" "}
              <Names items={r.changed} note={(c) => `(${c.details.join(", ")})`} onNavigate={onNavigate} />
            </li>
          )}
          <li className="muted">{r.unchanged} already up to date</li>
        </ul>
      )}
    </div>
  );
}

const SHOW = 5;

function Names<T extends { id: string; name: string }>({
  items,
  note,
  onNavigate,
}: {
  items: T[];
  note?: (item: T) => string;
  onNavigate: () => void;
}) {
  return (
    <>
      {items.slice(0, SHOW).map((item, i) => (
        <Fragment key={item.id}>
          {i > 0 && ", "}
          <Link href={`/contacts/${item.id}`} className="link" onClick={onNavigate}>
            {item.name}
          </Link>
          {note && <span className="muted"> {note(item)}</span>}
        </Fragment>
      ))}
      {items.length > SHOW && <span className="muted">, and {items.length - SHOW} more</span>}
    </>
  );
}
