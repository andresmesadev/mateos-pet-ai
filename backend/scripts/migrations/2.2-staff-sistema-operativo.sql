-- Entregable 2.2 — Sistema Operativo de Staff
-- Migración manual con backfill de horario base (ADR 003). NO aplicada automáticamente.
-- Implementa: docs/architecture/technical-design/staff-esquema-fisico.md
-- Backfill de Staff.availability (JSON, Fase 1) → StaffAvailability (base_schedule): ADR 003.
--
-- Ejecutar completo, en una sola transacción, contra la base de datos real.
-- Tras ejecutar, correr `prisma generate`.

BEGIN;

-- 1. Staff: nueva columna aditiva, con DEFAULT — no requiere backfill manual,
--    no rompe seed-staff.js ni staff.service.js (Fase 1).
ALTER TABLE "Staff" ADD COLUMN "generatesCommission" BOOLEAN NOT NULL DEFAULT true;

-- 2. Nuevas tablas
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

CREATE TABLE "StaffCapability" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffCapability_pkey" PRIMARY KEY ("id")
);

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

-- 3. Restricciones e índices
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffCapability" ADD CONSTRAINT "StaffCapability_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_replacesSettlementId_fkey"
    FOREIGN KEY ("replacesSettlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StaffAvailability_staffId_type_idx" ON "StaffAvailability"("staffId", "type");
CREATE INDEX "StaffAvailability_staffId_weekday_idx" ON "StaffAvailability"("staffId", "weekday");
CREATE INDEX "StaffAvailability_staffId_startAt_endAt_idx" ON "StaffAvailability"("staffId", "startAt", "endAt");
CREATE INDEX "StaffCapability_staffId_active_idx" ON "StaffCapability"("staffId", "active");
CREATE INDEX "StaffCapability_serviceId_active_idx" ON "StaffCapability"("serviceId", "active");
CREATE INDEX "Settlement_staffId_status_idx" ON "Settlement"("staffId", "status");
CREATE INDEX "Settlement_tenantId_staffId_periodStart_idx" ON "Settlement"("tenantId", "staffId", "periodStart");

-- 4. CHECK de coherencia de rangos (sin extensión adicional — ver Decisión Diferida #6
--    para lo que NO se protege a nivel de base de datos: el solapamiento de horario base).
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_base_schedule_range_check"
    CHECK (type <> 'base_schedule' OR ("startTime" IS NOT NULL AND "endTime" IS NOT NULL AND "startTime" < "endTime"));
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_absence_range_check"
    CHECK (type = 'base_schedule' OR ("startAt" IS NOT NULL AND "endAt" IS NOT NULL AND "startAt" < "endAt"));

-- 5. Índices únicos parciales — doble protección de invariantes críticos
--    (Principio Permanente del Esquema Físico, igual que PriceRule en 2.1).
CREATE UNIQUE INDEX "StaffCapability_active_target_unique"
    ON "StaffCapability" ("staffId", "serviceId")
    WHERE "active" = true;

CREATE UNIQUE INDEX "Settlement_active_period_unique"
    ON "Settlement" ("staffId", "periodStart", "periodEnd")
    WHERE "status" = 'active';

-- 6. Backfill — ADR 003: Staff.availability (JSON) → StaffAvailability (base_schedule).
--    Una sola vez. No se sincroniza después. El JSON original permanece intacto.
INSERT INTO "StaffAvailability" ("id", "staffId", "type", "weekday", "startTime", "endTime", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text || s."id" || dow."key"),
    s."id",
    'base_schedule',
    dow."weekday",
    (s."availability" -> dow."key" ->> 'open'),
    (s."availability" -> dow."key" ->> 'close'),
    CURRENT_TIMESTAMP
FROM "Staff" s
CROSS JOIN (VALUES ('sun',0), ('mon',1), ('tue',2), ('wed',3), ('thu',4), ('fri',5), ('sat',6)) AS dow("key", "weekday")
WHERE s."availability" IS NOT NULL
  AND s."availability" ? dow."key"
  AND (s."availability" -> dow."key" ->> 'active')::boolean = true
  AND (s."availability" -> dow."key" ->> 'open') IS NOT NULL
  AND (s."availability" -> dow."key" ->> 'close') IS NOT NULL;

COMMIT;
