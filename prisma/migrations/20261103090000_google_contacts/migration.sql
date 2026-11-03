-- Clients added to (or linked to) the connected Google account's contacts.
ALTER TABLE "Contact" ADD COLUMN "googleResourceName" TEXT;
ALTER TABLE "Contact" ADD COLUMN "googleSyncSkip" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Contact_googleResourceName_key" ON "Contact"("googleResourceName");

ALTER TABLE "GoogleAccount" ADD COLUMN "scopes" TEXT;
ALTER TABLE "GoogleAccount" ADD COLUMN "contactsGroup" TEXT;
ALTER TABLE "GoogleAccount" ADD COLUMN "lastContactsSyncAt" DATETIME;

CREATE TABLE "GoogleContactReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "candidatesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleContactReview_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GoogleContactReview_contactId_key" ON "GoogleContactReview"("contactId");
