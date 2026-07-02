-- Baseline de reconciliación del historial de migraciones (hallazgo C3, auditoría v2.1.0).
-- Consolida todos los cambios aplicados fuera del historial entre el 2026-06-18
-- (20260618120000_performance_indexes) y el cierre de la Fase 2 (v2.1.0):
-- entregables finales de Fase 1 (Commission, Expense, precios) via prisma db push,
-- Entregables 2.1/2.2 via db push y Entregable 2.3 via SQL manual
-- (backend/scripts/migrations/2.3-finanzas-sistema-operativo.sql).
-- Generado con: prisma migrate diff --from-schema <schema@f8b1fca> --to-schema prisma/schema.prisma --script
-- Marcada como aplicada en producción con prisma migrate resolve (la BD ya contenía todos estos objetos).

-- DropIndex
DROP INDEX "Transaction_appointmentId_key";

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "generatesCommission" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneAlt" TEXT;

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "defaultGroomingPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "price",
ADD COLUMN     "finalPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'manual_pos_sale';

-- CreateTable
CREATE TABLE "StaffAvailability" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weekday" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCapability" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "staffId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "replacesSettlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "appliesCommissionSplit" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsible" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyClose" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "incomeTotal" DECIMAL(10,2) NOT NULL,
    "expenseTotal" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "staffBreakdown" JSONB NOT NULL,
    "financialPeriodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "incomeTotal" DECIMAL(10,2) NOT NULL,
    "expenseTotal" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "appointmentId" TEXT NOT NULL,
    "staffId" TEXT,
    "resolvedPrice" DECIMAL(10,2) NOT NULL,
    "priceSource" TEXT NOT NULL,
    "splitRate" DECIMAL(4,3) NOT NULL,
    "staffShare" DECIMAL(10,2) NOT NULL,
    "businessShare" DECIMAL(10,2) NOT NULL,
    "serviceCategory" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAvailability_staffId_type_idx" ON "StaffAvailability"("staffId", "type");

-- CreateIndex
CREATE INDEX "StaffAvailability_staffId_weekday_idx" ON "StaffAvailability"("staffId", "weekday");

-- CreateIndex
CREATE INDEX "StaffAvailability_staffId_startAt_endAt_idx" ON "StaffAvailability"("staffId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "StaffCapability_staffId_active_idx" ON "StaffCapability"("staffId", "active");

-- CreateIndex
CREATE INDEX "StaffCapability_serviceId_active_idx" ON "StaffCapability"("serviceId", "active");

-- CreateIndex
CREATE INDEX "Settlement_staffId_status_idx" ON "Settlement"("staffId", "status");

-- CreateIndex
CREATE INDEX "Settlement_tenantId_staffId_periodStart_idx" ON "Settlement"("tenantId", "staffId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_tenantId_name_key" ON "ServiceCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "PriceRule_serviceId_active_idx" ON "PriceRule"("serviceId", "active");

-- CreateIndex
CREATE INDEX "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date");

-- CreateIndex
CREATE INDEX "DailyClose_tenantId_financialPeriodId_idx" ON "DailyClose"("tenantId", "financialPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClose_tenantId_date_key" ON "DailyClose"("tenantId", "date");

-- CreateIndex
CREATE INDEX "FinancialPeriod_tenantId_periodStart_idx" ON "FinancialPeriod"("tenantId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPeriod_tenantId_periodStart_periodEnd_key" ON "FinancialPeriod"("tenantId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_appointmentId_key" ON "Commission"("appointmentId");

-- CreateIndex
CREATE INDEX "Commission_tenantId_completedAt_idx" ON "Commission"("tenantId", "completedAt");

-- CreateIndex
CREATE INDEX "Commission_staffId_completedAt_idx" ON "Commission"("staffId", "completedAt");

-- CreateIndex
CREATE INDEX "Service_tenantId_categoryId_idx" ON "Service"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "Service_tenantId_active_idx" ON "Service"("tenantId", "active");

-- CreateIndex
CREATE INDEX "MedicalRecord_petId_type_idx" ON "MedicalRecord"("petId", "type");

-- CreateIndex
CREATE INDEX "MedicalRecord_type_date_idx" ON "MedicalRecord"("type", "date");

-- CreateIndex
CREATE INDEX "MedicalRecord_nextControlAt_idx" ON "MedicalRecord"("nextControlAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_appointmentId_origin_key" ON "Transaction"("appointmentId", "origin");

-- AddForeignKey
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCapability" ADD CONSTRAINT "StaffCapability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_replacesSettlementId_fkey" FOREIGN KEY ("replacesSettlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_financialPeriodId_fkey" FOREIGN KEY ("financialPeriodId") REFERENCES "FinancialPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPeriod" ADD CONSTRAINT "FinancialPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
