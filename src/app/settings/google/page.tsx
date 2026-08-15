import { getGoogleAccount } from "@/lib/google";
import { disconnectGoogle } from "@/lib/actions/googleCalendar";

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const account = await getGoogleAccount();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Google Calendar</h1>
        <p className="muted mt-1 text-sm">
          Connect your Google account so tasks with a due date can be added to
          your calendar as 30-minute reminders (9:00 AM on the due date).
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
            <form action={disconnectGoogle}>
              <button type="submit" className="btn-danger-text text-sm">
                Disconnect
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="muted text-sm">Not connected.</span>
            <a href="/api/google/connect" className="btn-primary">
              Connect Google Calendar
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
