-- Entregable 2.3 — Sistema Operativo de Finanzas
-- Migración manual. NO aplicada automáticamente.
-- Implementa: docs/architecture/technical-design/finanzas-esquema-fisico.md
-- Reconciliación aplicada: ADR 005 (docs/decisions/005-cobro-especializacion-transaccion.md)
--   Expense se extiende para representar Gasto. Transaction se extiende (campo `origin`)
--   para representar Cobro como origen especializado, no como entidad nueva.
--
-- Ejecutar completo, en una sola transacción, contra la base de datos real.
-- Tras ejecutar, correr `prisma generate`.

BEGIN;

-- 1. Expense: columnas aditivas, con DEFAULT donde aplica — no requiere backfill manual,
--    no rompe expenses.routes.js (Fase 1). `responsible` queda nullable: Fase 1 no lo captura.
ALTER TABLE "Expense" ADD COLUMN "responsible" TEXT;
ALTER TABLE "Expense" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Expense" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "voidReason" TEXT;

-- 2. Transaction: columna aditiva `origin`, con DEFAULT que reclasifica correctamente
--    todas las filas existentes — ninguna Transaction de Fase 1 pudo nacer de un Cobro
--    automático, porque ese origen no existía hasta este entregable.
ALTER TABLE "Transaction" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'manual_pos_sale';

-- 3. Reemplazo de la unicidad global de appointmentId por unicidad condicionada por origin
--    (especialización de la invariante, no una reducción de garantías — ver
--    finanzas-esquema-fisico.md sección 3). No rompe transactions.routes.js: el manejo
--    existente del error P2002 sigue aplicando, ahora por (appointmentId, origin).
DROP INDEX "Transaction_appointmentId_key";
CREATE UNIQUE INDEX "Transaction_appointmentId_origin_key" ON "Transaction"("appointmentId", "origin");

-- 4. Nuevas tablas — sin backfill: no existe ningún Cierre del Día ni Período
--    Financiero histórico que reconstruir.
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

-- 5. Índices
CREATE INDEX "DailyClose_tenantId_financialPeriodId_idx" ON "DailyClose"("tenantId", "financialPeriodId");
-- Doble protección: DailyClose no admite anulación en este entregable, por lo que
-- basta un índice único simple (no parcial) — ver finanzas-esquema-fisico.md sección 3.
CREATE UNIQUE INDEX "DailyClose_tenantId_date_key" ON "DailyClose"("tenantId", "date");

CREATE INDEX "FinancialPeriod_tenantId_periodStart_idx" ON "FinancialPeriod"("tenantId", "periodStart");
CREATE UNIQUE INDEX "FinancialPeriod_tenantId_periodStart_periodEnd_key" ON "FinancialPeriod"("tenantId", "periodStart", "periodEnd");

-- 6. Claves foráneas
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_financialPeriodId_fkey"
  FOREIGN KEY ("financialPeriodId") REFERENCES "FinancialPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialPeriod" ADD CONSTRAINT "FinancialPeriod_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
