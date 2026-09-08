-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "milestone30SentAt" DATETIME;
ALTER TABLE "Policy" ADD COLUMN "milestone60SentAt" DATETIME;
ALTER TABLE "Policy" ADD COLUMN "milestone90SentAt" DATETIME;

-- CreateTable
CREATE TABLE "MilestoneEmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL
);

-- Seed default copy for all three milestones so the feature works out of
-- the box; fully editable afterward from the settings page.
INSERT INTO "MilestoneEmailTemplate" ("id", "subject", "body") VALUES
('day30', 'Checking in on your new plan', 'Hi {{firstName}},

It has been about 30 days since your {{planName}} plan with {{carrier}} became effective. I wanted to check in and see how things are going so far.

If you have any questions about your benefits or have run into anything confusing, just reply to this email or give me a call.

Best,
Chris'),
('day60', '60-day check-in on your Medicare plan', 'Hi {{firstName}},

You are now about 60 days into your {{planName}} plan with {{carrier}}. I wanted to reach out and make sure everything is going smoothly - appointments, prescriptions, and any other benefits you have used.

Let me know if anything has come up, or if you would like to review your coverage.

Best,
Chris'),
('day90', '90 days in - how is your plan working out?', 'Hi {{firstName}},

It has been 90 days since your {{planName}} plan with {{carrier}} took effect. This is usually a good point to take stock of how the plan is working for you - your doctors, pharmacy, and any other benefits.

If anything is not working the way you expected, or you would just like to talk through your options, I am happy to help.

Best,
Chris');
