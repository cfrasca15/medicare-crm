-- The year this contact last got a birthday email, so it goes out once a year.
ALTER TABLE "Contact" ADD COLUMN "birthdayEmailYear" INTEGER;

-- A template can be switched off. Existing ones (30/60/90 days) stay on.
ALTER TABLE "MilestoneEmailTemplate" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

-- Birthday email to clients. Starts off, so the wording gets a look before
-- anything is sent; turn it on from the Milestone Emails settings page.
INSERT INTO "MilestoneEmailTemplate" ("id", "subject", "body", "enabled") VALUES
('birthday', 'Happy birthday, {{firstName}}!', 'Hi {{firstName}},

Wishing you a very happy birthday! I hope you have a wonderful day.

As always, if anything comes up with your Medicare coverage, just reply to this email or give me a call.

Best,
Chris', false);
