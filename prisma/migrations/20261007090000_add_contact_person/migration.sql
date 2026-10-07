-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "altContactName" TEXT;
ALTER TABLE "Contact" ADD COLUMN "altContactRelationship" TEXT;
ALTER TABLE "Contact" ADD COLUMN "altContactPhone" TEXT;
ALTER TABLE "Contact" ADD COLUMN "altContactEmail" TEXT;
ALTER TABLE "Contact" ADD COLUMN "altContactPreferred" BOOLEAN NOT NULL DEFAULT false;
