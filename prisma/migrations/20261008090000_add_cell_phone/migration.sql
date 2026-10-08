-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "cellPhone" TEXT;
ALTER TABLE "Contact" ADD COLUMN "cellPreferred" BOOLEAN NOT NULL DEFAULT false;
