-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "hasMailingAddress" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "mailingAddress" TEXT;
ALTER TABLE "Contact" ADD COLUMN "mailingCity" TEXT;
ALTER TABLE "Contact" ADD COLUMN "mailingState" TEXT;
ALTER TABLE "Contact" ADD COLUMN "mailingZip" TEXT;
