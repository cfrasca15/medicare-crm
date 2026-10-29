import Link from "next/link";
import { loadNeedsReply, senderName, waitingFor, type NeedsReplyItem } from "@/lib/needsReply";

export const dynamic = "force-dynamic";

export default async function NeedsReplyPage() {
  const result = await loadNeedsReply();

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Needs a Reply</h1>
        <p className="muted mt-1 text-sm">
          Gmail conversations in your inbox (Primary tab, last 30 days) where someone else wrote
          last. Reply, or archive it in Gmail, and it drops off. Also in your morning email.
        </p>
      </div>

      {result.status === "off" && (
        <p className="surface p-4 text-sm">
          Google isn&apos;t connected. Connect it on the{" "}
          <Link href="/settings/google" className="link">
            Google
          </Link>{" "}
          settings page.
        </p>
      )}

      {result.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t check Gmail: {result.message}</p>
      )}

      {result.status === "ok" && (
        <>
          <section>
            <h2 className="section-label mb-2">From contacts · {result.fromContacts.length}</h2>
            <ThreadList items={result.fromContacts} empty="No contact is waiting on a reply." />
          </section>
          <section>
            <h2 className="section-label mb-2">Everyone else · {result.others.length}</h2>
            <ThreadList items={result.others} empty="Nothing else waiting." />
          </section>
        </>
      )}
    </div>
  );
}

function ThreadList({ items, empty }: { items: NeedsReplyItem[]; empty: string }) {
  if (!items.length) return <p className="muted surface p-4 text-sm">{empty}</p>;
  return (
    <ul className="surface divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((t) => (
        <li key={t.threadId} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {t.contactId ? (
                <Link href={`/contacts/${t.contactId}`} className="font-medium hover:underline">
                  {t.contactName}
                </Link>
              ) : (
                <span className="font-medium">{senderName(t.from)}</span>
              )}
              {t.unread && (
                <span className="pill bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Unread</span>
              )}
            </div>
            <p className="truncate">{t.subject}</p>
            <p className="muted truncate text-xs">{t.snippet}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="muted text-xs">waiting {waitingFor(t.date)}</span>
            <a href={t.url} target="_blank" rel="noopener noreferrer" className="link text-xs">
              Open in Gmail
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
