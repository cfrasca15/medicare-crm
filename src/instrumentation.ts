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

  // Once daily at 9:00 AM server time.
  cron.schedule("0 9 * * *", () => {
    runMilestoneEmailCheck().catch((err) => {
      console.error("Milestone email check failed:", err);
    });
    advanceEnrolledStages().catch((err) => {
      console.error("Stage automation check failed:", err);
    });
  });

  console.log("Daily checks scheduled (milestone emails + stage automation, 9:00 AM server time).");
}
