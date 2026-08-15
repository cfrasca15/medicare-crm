-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "dateOfBirth" DATETIME,
    "medicareId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW_LEAD',
    "notes" TEXT,
    "integrityContactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "planType" TEXT,
    "policyNumber" TEXT,
    "effectiveDate" DATETIME,
    "termDate" DATETIME,
    "commissionStatus" TEXT,
    "commissionAmount" REAL,
    "annualPremium" REAL,
    "integrityPolicyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Policy_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_integrityContactId_key" ON "Contact"("integrityContactId");

-- CreateIndex
CREATE INDEX "Contact_stage_idx" ON "Contact"("stage");

-- CreateIndex
CREATE INDEX "Contact_lastName_firstName_idx" ON "Contact"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_integrityPolicyId_key" ON "Policy"("integrityPolicyId");

-- CreateIndex
CREATE INDEX "Policy_contactId_idx" ON "Policy"("contactId");

-- CreateIndex
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_contactId_idx" ON "Task"("contactId");
