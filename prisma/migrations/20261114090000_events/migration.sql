-- In-person events and the people who RSVP'd or walked in. Guests stay in
-- these tables, apart from Contact, until "Add to Contacts" is clicked.
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "location" TEXT,
    "attendanceDoneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EventGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "walkIn" BOOLEAN NOT NULL DEFAULT false,
    "attended" BOOLEAN,
    "noEmail" BOOLEAN NOT NULL DEFAULT false,
    "contactId" TEXT,
    "notInterested" BOOLEAN NOT NULL DEFAULT false,
    "emailKind" TEXT,
    "emailSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventGuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventGuest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Event_date_idx" ON "Event"("date");
CREATE INDEX "EventGuest_eventId_idx" ON "EventGuest"("eventId");
CREATE INDEX "EventGuest_contactId_idx" ON "EventGuest"("contactId");

-- The two follow-up emails for an event. They only go out after "Attendance
-- is finished" is clicked on that event, so they start switched on.
INSERT INTO "MilestoneEmailTemplate" ("id", "subject", "body", "enabled") VALUES
('eventAttended', 'Thank you for coming, {{firstName}}!', 'Hi {{firstName}},

Thank you for joining me at {{eventName}} on {{eventDate}}. I hope it was helpful.

If any questions came up afterward, just reply to this email or give me a call. I''m always happy to help.

Best,
Chris

If you''d rather not get emails from me, reply and let me know.', true),
('eventMissed', 'Sorry we missed you, {{firstName}}', 'Hi {{firstName}},

I''m sorry we missed you at {{eventName}} on {{eventDate}}. I know things come up.

If you''d still like to go over what we covered, reply to this email or give me a call and we can find a time that works for you.

Best,
Chris

If you''d rather not get emails from me, reply and let me know.', true);
