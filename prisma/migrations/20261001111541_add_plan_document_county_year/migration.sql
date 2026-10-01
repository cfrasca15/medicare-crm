-- DropIndex
DROP INDEX "PlanDocument_carrier_planName_idx";

-- AlterTable
ALTER TABLE "PlanDocument" ADD COLUMN "county" TEXT;
ALTER TABLE "PlanDocument" ADD COLUMN "planYear" INTEGER;

-- CreateIndex
CREATE INDEX "PlanDocument_carrier_county_planName_idx" ON "PlanDocument"("carrier", "county", "planName");
