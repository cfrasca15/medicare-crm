-- CreateTable
CREATE TABLE "PlanDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carrier" TEXT,
    "planName" TEXT,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PlanDocument_carrier_planName_idx" ON "PlanDocument"("carrier", "planName");
