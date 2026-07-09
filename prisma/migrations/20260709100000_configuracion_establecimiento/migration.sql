-- Entregable 4.3 (Fase 4) — Configuración por Establecimiento (Alcance A)
-- Reemplaza los dos PrismaBusinessConfigReader hardcodeados (Services,
-- Staff) por persistencia real en Tenant. Sin relación con el motor
-- conversacional (Alcance B, diferido — ver Reconciliación Arquitectónica).

ALTER TABLE "Tenant" ADD COLUMN     "activeModules" TEXT[] DEFAULT ARRAY['grooming', 'veterinary']::TEXT[],
ADD COLUMN     "commissionSplitRate" DECIMAL(4,3) NOT NULL DEFAULT 0.5;
