import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getGoogleAccount, hasContactsScope } from "@/lib/google";
import { disconnectGoogle } from "@/lib/actions/googleCalendar";
import { formatDateTime } from "@/lib/date";
import { NAME_ONLY, type GoogleCandidate } from "@/lib/googleContactsMatch";
import { GoogleContactButton } from "@/components/GoogleContactButton";
import { GoogleContactsSyncButton, LinkAllNameMatchesButton } from "@/components/GoogleContactsSyncButton";
import { GoogleContactsPreview } from "@/components/GoogleContactsPreview";
import { setGoogleAutoSync } from "@/lib/actions/googleContacts";

export const dynamic = "force-dynamic";

const CLIENT_STAGES = ["ENROLLED", "RETAINED", "CURRENT_CLIENT"] as const;

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const account = await getGoogleAccount();
  const contactsOn = hasContactsScope(account);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Google</h1>
        <p className="muted mt-1 text-sm">
          Connect your Google account so tasks with a due date can be added to
          your calendar as 30-minute reminders (9:00 AM on the due date), so
          you can send and track email with contacts from the CRM using
          Gmail, and so your clients are in your Google Contacts.
        </p>
      </div>

      {connected && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-500/10 dark:text-green-300">
          Connected successfully.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300">
          Couldn&apos;t connect: {error}
        </div>
      )}

      <div className="surface p-4">
        {account ? (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">Connected</span>
              <span className="muted"> as {account.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="/api/google/connect" className="btn-secondary text-sm">
                Reconnect
              </a>
              <form action={disconnectGoogle}>
                <button type="submit" className="btn-danger-text text-sm">
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="muted text-sm">Not connected.</span>
            <a href="/api/google/connect" className="btn-primary">
              Connect Google
            </a>
          </div>
        )}
      </div>

      {account && !contactsOn && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="font-medium">Google Contacts isn&apos;t on yet.</span> Click Reconnect and allow the CRM to
          see and change your contacts. The People API also has to be turned on in the CRM&apos;s Google Cloud project
          (APIs &amp; Services → Library → People API).
        </div>
      )}

      {account && contactsOn && <GoogleContactsSection lastSync={account.lastContactsSyncAt} auto={account.contactsAutoSync} />}

      {account && (
        <p className="muted text-xs">
          If you connected Google before Gmail or Contacts access was added,
          click Reconnect to grant the new permissions — it won&apos;t affect
          your existing calendar sync.
        </p>
      )}
    </div>
  );
}

async function GoogleContactsSection({ lastSync, auto }: { lastSync: Date | null; auto: boolean }) {
  const [inGoogle, notYet, skipped, reviews] = await Promise.all([
    prisma.contact.count({ where: { googleResourceName: { not: null } } }),
    prisma.contact.count({
      where: { stage: { in: [...CLIENT_STAGES] }, googleResourceName: null, googleSyncSkip: false, googleReview: null },
    }),
    prisma.contact.findMany({
      where: { googleSyncSkip: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.googleContactReview.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true, googleResourceName: true } } },
      orderBy: { contact: { lastName: "asc" } },
    }),
  ]);
  const rows = reviews.map((r) => ({
    ...r,
    candidates: JSON.parse(r.candidatesJson) as GoogleCandidate[],
  }));
  const nameMatches = rows.filter((r) => r.reason === NAME_ONLY && r.candidates.length === 1).length;

  return (
    <>
      <div className="surface flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Google Contacts</h2>
            <p className="muted mt-1 text-sm">
              Clients (Enrolled, Retained, Current Client) are added to your Google contacts with their name, phone
              and email, under the label &quot;Medicare CRM&quot;. Anyone already there is linked instead of added
              twice. The CRM only adds missing phones and emails to a card; it never changes or deletes anything in
              Google.
            </p>
          </div>
          <GoogleContactsSyncButton />
        </div>
        <form
          action={setGoogleAutoSync.bind(null, !auto)}
          className="flex flex-wrap items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
        >
          <span>
            <span className="font-medium">Automatic sync: {auto ? "On" : "Off"}.</span>{" "}
            <span className="muted">
              {auto
                ? "Clients are synced every 30 minutes and when you save one."
                : "Nothing changes in Google unless you click a button. Preview first, then turn this on."}
            </span>
          </span>
          <button type="submit" className={auto ? "btn-secondary" : "btn-primary"}>
            {auto ? "Turn off" : "Turn on"}
          </button>
        </form>
        <GoogleContactsPreview />
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="font-medium">{inGoogle}</span> <span className="muted">in Google</span>
          </span>
          <span>
            <span className="font-medium">{notYet}</span> <span className="muted">clients not added yet</span>
          </span>
          <span>
            <span className="font-medium">{rows.length}</span> <span className="muted">need a look</span>
          </span>
          {lastSync && <span className="muted">Last sync {formatDateTime(lastSync)}</span>}
        </div>
      </div>

      {rows.length > 0 && (
        <div id="review" className="surface flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Need a look</h2>
              <p className="muted mt-1 text-sm">
                Google has someone who might be the same person, but not for sure. Pick their card, add them as new,
                or leave them out.
              </p>
            </div>
            {nameMatches > 0 && <LinkAllNameMatchesButton count={nameMatches} />}
          </div>
          <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3">
                <Link href={`/contacts/${r.contact.id}`} className="font-medium hover:underline">
                  {r.contact.firstName} {r.contact.lastName}
                </Link>
                <GoogleContactButton
                  contactId={r.contact.id}
                  resourceName={r.contact.googleResourceName}
                  skipped={false}
                  review={{ reason: r.reason, candidates: r.candidates }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {skipped.length > 0 && (
        <p className="muted text-sm">
          Left out of Google ({skipped.length}):{" "}
          {skipped.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/contacts/${c.id}`} className="link">
                {c.firstName} {c.lastName}
              </Link>
            </span>
          ))}
        </p>
      )}
    </>
  );
}
