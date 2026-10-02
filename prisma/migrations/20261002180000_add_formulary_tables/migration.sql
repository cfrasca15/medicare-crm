-- CreateTable
CREATE TABLE "Formulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carrier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FormularyDrug" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formularyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isBrand" BOOLEAN NOT NULL,
    "tier" INTEGER NOT NULL,
    "limits" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "subcategory" TEXT,
    CONSTRAINT "FormularyDrug_formularyId_fkey" FOREIGN KEY ("formularyId") REFERENCES "Formulary" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormularyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formularyId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "county" TEXT,
    CONSTRAINT "FormularyPlan_formularyId_fkey" FOREIGN KEY ("formularyId") REFERENCES "Formulary" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Formulary_carrier_year_idx" ON "Formulary"("carrier", "year");

-- CreateIndex
CREATE INDEX "FormularyDrug_formularyId_idx" ON "FormularyDrug"("formularyId");

-- CreateIndex
CREATE INDEX "FormularyDrug_name_idx" ON "FormularyDrug"("name");

-- CreateIndex
CREATE INDEX "FormularyPlan_formularyId_idx" ON "FormularyPlan"("formularyId");
