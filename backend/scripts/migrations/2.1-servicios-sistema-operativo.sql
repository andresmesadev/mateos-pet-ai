-- Entregable 2.1 — Sistema Operativo de Servicios
-- Migración manual con backfill. NO aplicada automáticamente.
-- Implementa: docs/architecture/technical-design/servicios-esquema-fisico.md
--
-- Orden de ejecución: este script es secuencial y debe correr completo, en una
-- sola transacción, contra la base de datos real (psql, o el cliente SQL de Neon).
-- `prisma db push` NO puede usarse para este cambio: db push no sabe cómo
-- migrar los datos existentes de Service.category (String) a Service.categoryId
-- (relación). Por eso este script se ejecuta a mano, y recién después se corre
-- `prisma generate` para regenerar el cliente TypeScript/JS contra el nuevo schema.prisma.

BEGIN;

-- 1. Crear ServiceCategory
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "appliesCommissionSplit" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- 2. Crear PriceRule (sin dependencia de datos existentes)
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

-- 3. Backfill: una fila de ServiceCategory por cada (tenantId, category) distinto
--    ya presente en Service. "grooming" nace con split de comisión activo,
--    consistente con la regla documentada en el Modelo de Dominio
--    (grooming 50/50, veterinaria 100% al negocio). El operador puede
--    ajustar appliesCommissionSplit después vía UpdateServiceCategory si
--    algún caso real no calza con este valor por defecto.
INSERT INTO "ServiceCategory" ("id", "tenantId", "name", "appliesCommissionSplit", "active", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text || coalesce("tenantId", '') || category),
    "tenantId",
    category,
    (category = 'grooming'),
    true,
    CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "tenantId", "category" FROM "Service") AS distinct_categories;

-- 4. Agregar categoryId como columna nullable temporalmente
ALTER TABLE "Service" ADD COLUMN "categoryId" TEXT;

-- 5. Backfill: asignar a cada Service su categoryId correspondiente
UPDATE "Service" s
SET "categoryId" = sc."id"
FROM "ServiceCategory" sc
WHERE sc."name" = s."category"
  AND (sc."tenantId" = s."tenantId" OR (sc."tenantId" IS NULL AND s."tenantId" IS NULL));

-- 6. Verificación de seguridad: abortar si quedó algún Service sin categoryId
--    (no debería pasar dado el paso 3, pero protege contra datos inconsistentes).
DO $$
DECLARE
  huerfanos INTEGER;
BEGIN
  SELECT COUNT(*) INTO huerfanos FROM "Service" WHERE "categoryId" IS NULL;
  IF huerfanos > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % servicios sin categoryId. Abortando migración.', huerfanos;
  END IF;
END $$;

-- 7. Ahora sí, columna obligatoria y se retira la columna vieja
ALTER TABLE "Service" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Service" DROP COLUMN "category";

-- 8. Restricciones e índices
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ServiceCategory_tenantId_name_key" ON "ServiceCategory"("tenantId", "name");
CREATE INDEX "Service_tenantId_categoryId_idx" ON "Service"("tenantId", "categoryId");
CREATE INDEX "Service_tenantId_active_idx" ON "Service"("tenantId", "active");
CREATE INDEX "PriceRule_serviceId_active_idx" ON "PriceRule"("serviceId", "active");

-- 9. Índice único parcial — garantía de base de datos para el invariante de PriceRule
--    (Principio Permanente del Esquema Físico: doble protección de invariantes críticos).
--    Solo restringe duplicados entre reglas ACTIVAS; una regla desactivada y una nueva
--    activa para el mismo destino pueden coexistir, preservando el historial.
CREATE UNIQUE INDEX "PriceRule_active_target_unique"
    ON "PriceRule" ("serviceId", "targetType", "targetId")
    WHERE "active" = true;

COMMIT;
