// Next.js calls register() once when the server process starts (both in
// dev and in the built `next start` container) — this is what schedules
// the daily policy-driven checks, since there's no other long-running
// background-job infrastructure in this app. The 30/60/90-day milestone
// emails and the Application Submitted -> Enrolled stage advance are
// independent of each other (one keys off Policy.milestoneXSentAt, the
// other off Contact.stage) but run on the same daily tick for simplicity.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __dailyChecksStarted?: boolean };
  if (g.__dailyChecksStarted) return;
  g.__dailyChecksStarted = true;

  const cron = await import("node-cron");
  const { runMilestoneEmailCheck } = await import("@/lib/milestoneEmails");
  const { advanceEnrolledStages } = await import("@/lib/stageAutomation");
  const { closePastAppointmentTasks } = await import("@/lib/taskAutomation");

  // Once daily at 9:00 AM server time.
  cron.schedule("0 9 * * *", () => {
    runMilestoneEmailCheck().catch((err) => {
      console.error("Milestone email check failed:", err);
    });
    advanceEnrolledStages().catch((err) => {
      console.error("Stage automation check failed:", err);
    });
    closePastAppointmentTasks().catch((err) => {
      console.error("Closing past appointment tasks failed:", err);
    });
  });

  // Calendly appointments that already happened shouldn't sit as overdue tasks.
  closePastAppointmentTasks()
    .then(({ closed }) => closed && console.log(`Marked ${closed} past Calendly appointment task(s) done.`))
    .catch((err) => console.error("Closing past appointment tasks failed:", err));

  // Contacts with a ZIP but no county get one filled in from the ZIP.
  import("@/lib/countyBackfill")
    .then(({ fillCountiesFromZip }) => fillCountiesFromZip())
    .then((n) => n && console.log(`Filled in the county for ${n} contact(s) from their ZIP.`))
    .catch((err) => console.error("County fill from ZIP failed:", err));

  console.log("Daily checks scheduled (milestone emails, stage automation, past appointments; 9:00 AM server time).");

  // The rest send email or pull from live accounts, so only the server
  // (`next start`) runs them, never `next dev` against a copy of the data.
  // Times are Pacific, whatever the container's clock says.
  if (process.env.NODE_ENV !== "production") return;
  const jobs = await import("@/lib/scheduledJobs");
  const pacific = { timezone: "America/Los_Angeles" };
  const run = (label: string, job: () => Promise<void>) => () => {
    job().catch((err) => console.error(`${label} failed:`, err));
  };

  // Integrity, Calendly and website leads every 30 minutes, 7 AM to 8:30 PM.
  cron.schedule("0,30 7-20 * * *", run("Scheduled syncs", jobs.runScheduledSyncs), pacific);
  // The digest to yourself at 7:30 AM, after that half hour's syncs.
  cron.schedule("30 7 * * *", run("Morning digest", jobs.runMorningDigest), pacific);
  cron.schedule("0 9 * * *", run("Birthday emails", jobs.runBirthdayEmailJob), pacific);
  // AEP review tasks (due Oct 1) on Sept 1; OEP check-ins (due Dec 18) on Dec 1.
  cron.schedule("0 8 1 9 *", run("AEP reminders", () => jobs.runSeasonalReminderJob("AEP")), pacific);
  cron.schedule("0 8 1 12 *", run("OEP reminders", () => jobs.runSeasonalReminderJob("OEP")), pacific);

  console.log("Scheduled: syncs every 30 min, morning digest 7:30 AM, birthday emails 9 AM, AEP/OEP reminders Sept 1/Dec 1 (Pacific).");
}
