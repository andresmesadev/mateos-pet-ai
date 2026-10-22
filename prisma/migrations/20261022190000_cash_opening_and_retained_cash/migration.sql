ALTER TABLE "DailyClose" ADD COLUMN "openingCashAmount" DECIMAL(10,2),
  ADD COLUMN "retainedCashAmount" DECIMAL(10,2);
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_cash_nonnegative"
  CHECK (("openingCashAmount" IS NULL OR "openingCashAmount" >= 0) AND ("retainedCashAmount" IS NULL OR "retainedCashAmount" >= 0));

CREATE TABLE "CashOpening" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "date" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL CHECK ("amount" >= 0),
  "sourceDailyCloseId" TEXT,
  "actorId" TEXT,
  "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CashOpening_tenantId_date_key" ON "CashOpening"("tenantId", "date");
