-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "submittedAt" DATETIME;

-- Plans with an effective date start out with the day they were added to the
-- CRM (Pacific time, stored as a date) as their submitted date.
UPDATE "Policy"
SET "submittedAt" = strftime('%Y-%m-%dT00:00:00.000+00:00', "createdAt", '-7 hours')
WHERE "effectiveDate" IS NOT NULL;
