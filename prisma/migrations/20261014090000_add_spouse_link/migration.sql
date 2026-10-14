-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "spouseId" TEXT;

-- CreateIndex
CREATE INDEX "Contact_spouseId_idx" ON "Contact"("spouseId");
