-- Each client's status in a year's AEP review (the AEP worklist).
CREATE TABLE "AepReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AepReview_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AepReview_contactId_year_key" ON "AepReview"("contactId", "year");
CREATE INDEX "AepReview_year_idx" ON "AepReview"("year");
