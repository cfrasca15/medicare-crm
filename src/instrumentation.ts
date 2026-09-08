// Next.js calls register() once when the server process starts (both in
// dev and in the built `next start` container) — this is what schedules
// the daily 30/60/90-day milestone email check, since there's no other
// long-running background-job infrastructure in this app.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __milestoneCronStarted?: boolean };
  if (g.__milestoneCronStarted) return;
  g.__milestoneCronStarted = true;

  const cron = await import("node-cron");
  const { runMilestoneEmailCheck } = await import("@/lib/milestoneEmails");

  // Once daily at 9:00 AM server time.
  cron.schedule("0 9 * * *", () => {
    runMilestoneEmailCheck().catch((err) => {
      console.error("Milestone email check failed:", err);
    });
  });

  console.log("Milestone email check scheduled (daily at 9:00 AM server time).");
}
