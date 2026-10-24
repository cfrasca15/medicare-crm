-- Integrity leads the sync should not import again (a duplicate merged into
-- another contact).
CREATE TABLE "IgnoredIntegrityLead" (
    "integrityContactId" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
