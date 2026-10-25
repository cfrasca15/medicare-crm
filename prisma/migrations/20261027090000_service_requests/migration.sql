-- Client service requests (ID cards, billing, network problems...) and
-- their updates, which are Activity rows.
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "policyId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "waitingOn" TEXT,
    "followUpOn" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ServiceRequest_contactId_idx" ON "ServiceRequest"("contactId");
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- SQLite can't add a foreign key to an existing table, so Activity is rebuilt.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outcome" TEXT,
    "summary" TEXT NOT NULL,
    "serviceRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("id", "contactId", "type", "outcome", "summary", "createdAt")
SELECT "id", "contactId", "type", "outcome", "summary", "createdAt" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_contactId_createdAt_idx" ON "Activity"("contactId", "createdAt");
CREATE INDEX "Activity_type_createdAt_idx" ON "Activity"("type", "createdAt");
CREATE INDEX "Activity_serviceRequestId_idx" ON "Activity"("serviceRequestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
