-- CreateTable
CREATE TABLE "ContactNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ContactNote_contactId_idx" ON "ContactNote"("contactId");

-- Carry over each contact's existing single-blob "notes" field as its first
-- dated entry, so switching to a dated notes log doesn't lose anything.
-- Timestamped with the contact's updatedAt as the closest available proxy
-- for when it was last touched (the old field had no timestamp of its own).
-- The "notes" column on Contact is intentionally left in place, unused, as
-- a harmless backup rather than risking a destructive DROP COLUMN.
INSERT INTO "ContactNote" ("id", "contactId", "body", "createdAt")
SELECT lower(hex(randomblob(16))), "id", "notes", "updatedAt"
FROM "Contact"
WHERE "notes" IS NOT NULL AND trim("notes") != '';
