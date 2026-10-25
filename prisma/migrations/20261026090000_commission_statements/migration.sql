-- Uploaded carrier commission statements and their lines, each applied to a
-- client's plan.
CREATE TABLE "CommissionStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carrier" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statementId" TEXT NOT NULL,
    "policyId" TEXT,
    "memberName" TEXT NOT NULL,
    "memberId" TEXT,
    "amount" REAL NOT NULL,
    "paidOn" DATETIME,
    "description" TEXT,
    "lineKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CommissionStatement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommissionPayment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommissionPayment_lineKey_key" ON "CommissionPayment"("lineKey");
CREATE INDEX "CommissionPayment_statementId_idx" ON "CommissionPayment"("statementId");
CREATE INDEX "CommissionPayment_policyId_idx" ON "CommissionPayment"("policyId");

-- Remembered column choices per statement layout.
CREATE TABLE "CommissionLayout" (
    "signature" TEXT NOT NULL PRIMARY KEY,
    "carrier" TEXT NOT NULL,
    "mapping" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
