-- Entregable 4.1 (Fase 4) — Saneamiento tenant-blind
-- M1: unicidad de User.phone deja de ser global y pasa a ser por tenant.
-- A6: previene TOCTOU en la reserva de citas mediante un índice único
--     parcial sobre la unidad real de reserva (bucket de tipo de servicio),
--     no sobre staffId (que el sistema no usa hoy para disponibilidad).

-- M1 -----------------------------------------------------------------------
DROP INDEX "User_phone_key";

CREATE UNIQUE INDEX "User_tenantId_phone_key" ON "User"("tenantId", "phone");

-- A6 -----------------------------------------------------------------------
ALTER TABLE "Appointment" ADD COLUMN "availabilityBucket" TEXT;

-- Backfill de filas existentes con el mismo mapeo bucket usado en
-- appointment.service.js (mapToAvailabilityServiceType).
UPDATE "Appointment"
SET "availabilityBucket" = CASE
  WHEN lower("serviceType") IN (
    'grooming', 'baño básico', 'baño + corte', 'baño medicado',
    'baño antipulgas', 'spa canino/felino', 'deslanado', 'colorimetría'
  ) THEN 'grooming'
  WHEN lower("serviceType") IN ('vet', 'general_appointment', 'medication')
    THEN 'vet'
  ELSE lower("serviceType")
END;

-- Índice único parcial: una reserva activa por tenant + bucket + instante.
-- Parcial porque excluye citas canceladas (no ocupan el slot) y filas sin
-- tenant/bucket resuelto (datos legados fuera del alcance de este saneamiento).
CREATE UNIQUE INDEX "appointment_tenant_bucket_slot_active_unique"
  ON "Appointment" ("tenantId", "availabilityBucket", "date")
  WHERE "status" != 'cancelled'
    AND "tenantId" IS NOT NULL
    AND "availabilityBucket" IS NOT NULL;
