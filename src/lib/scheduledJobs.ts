import { runIntegrityLeadSync } from "@/lib/actions/integritySync";
import { runCalendlySync } from "@/lib/actions/calendlySync";
import { runWebsiteLeadsSync } from "@/lib/actions/websiteLeadsSync";
import { runSeasonalReminders } from "@/lib/actions/reminders";
import { sendMorningDigest } from "@/lib/morningDigest";
import { runBirthdayEmails } from "@/lib/birthdayEmails";

// The jobs instrumentation.ts schedules besides the 9 AM checks: the syncs
// that used to need a button click, the morning digest, birthday emails and
// the AEP/OEP reminder tasks. Each sync is skipped when it isn't set up.

let syncsInFlight: Promise<void> | null = null;

// Integrity, Calendly and website leads, one after another. A run already in
// progress is shared rather than started twice (the digest waits on it too).
export function runScheduledSyncs(): Promise<void> {
  syncsInFlight ??= (async () => {
    try {
      if (process.env.INTEGRITY_CLIENT_ID) {
        await runIntegrityLeadSync().catch((err) => console.error("Scheduled Integrity sync failed:", err));
      }
      if (process.env.CALENDLY_API_TOKEN) {
        await runCalendlySync().catch((err) => console.error("Scheduled Calendly sync failed:", err));
      }
      if (process.env.WEBSITE_LEADS_AIRTABLE_TOKEN && process.env.WEBSITE_LEADS_BASE_ID) {
        const r = await runWebsiteLeadsSync();
        if (!r.ok) console.error("Scheduled website leads sync failed:", r.error);
        else if (r.imported) console.log(`Imported ${r.imported} new website lead(s).`);
      }
    } finally {
      syncsInFlight = null;
    }
  })();
  return syncsInFlight;
}

// Fresh data first, so the digest includes overnight leads and bookings.
export async function runMorningDigest(): Promise<void> {
  await runScheduledSyncs();
  await sendMorningDigest();
  console.log("Morning digest sent.");
}

export async function runBirthdayEmailJob(): Promise<void> {
  const r = await runBirthdayEmails();
  if (r.sent) console.log(`Sent ${r.sent} birthday email(s).`);
  for (const e of r.errors) console.error(`Birthday email to ${e.contactName} failed: ${e.error}`);
}

export async function runSeasonalReminderJob(season: "AEP" | "OEP"): Promise<void> {
  const r = await runSeasonalReminders(season);
  console.log(`${season} reminders: ${r.created} created, ${r.skipped} already had one.`);
}
