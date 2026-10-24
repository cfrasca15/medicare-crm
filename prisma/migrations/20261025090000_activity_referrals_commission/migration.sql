-- Logged calls and automatic history entries (stage changes) for the
-- contact timeline.
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outcome" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Activity_contactId_createdAt_idx" ON "Activity"("contactId", "createdAt");
CREATE INDEX "Activity_type_createdAt_idx" ON "Activity"("type", "createdAt");

-- Who referred this contact (another contact).
ALTER TABLE "Contact" ADD COLUMN "referredById" TEXT;
CREATE INDEX "Contact_referredById_idx" ON "Contact"("referredById");

-- Commission actually received for a plan, to compare with what's expected.
ALTER TABLE "Policy" ADD COLUMN "commissionReceived" REAL;
ALTER TABLE "Policy" ADD COLUMN "commissionPaidAt" DATETIME;
