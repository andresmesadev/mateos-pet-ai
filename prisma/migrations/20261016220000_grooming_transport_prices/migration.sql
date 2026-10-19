ALTER TABLE "Service" ALTER COLUMN "duration" DROP NOT NULL;
ALTER TABLE "Service" ADD CONSTRAINT "Service_reservation_duration_check" CHECK (
  ("requiresAppointment" = false AND ("duration" IS NULL OR "duration" > 0)) OR
  ("requiresAppointment" = true AND "duration" IS NOT NULL AND "duration" > 0)
);
ALTER TABLE "Pet" ADD COLUMN "defaultGroomingWithTransportPrice" DECIMAL(10,2);
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_grooming_transport_total_check" CHECK (
  "defaultGroomingWithTransportPrice" IS NULL OR
  ("defaultGroomingWithTransportPrice" >= 0 AND ("defaultGroomingPrice" IS NULL OR "defaultGroomingWithTransportPrice" >= "defaultGroomingPrice"))
);
ALTER TABLE "Appointment"
  ADD COLUMN "transportMode" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "transportPrice" DECIMAL(10,2),
  ADD COLUMN "transportPriceSource" TEXT,
  ADD COLUMN "transportZoneId" TEXT,
  ADD COLUMN "transportZoneName" TEXT,
  ADD COLUMN "transportAddress" TEXT,
  ADD COLUMN "transportScope" TEXT,
  ADD COLUMN "transportSharedWithId" TEXT;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_transport_mode_check" CHECK ("transportMode" IN ('none','round_trip','pickup','delivery','shared'));
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_transport_price_check" CHECK ("transportPrice" IS NULL OR "transportPrice" >= 0);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_transport_shared_check" CHECK (
  ("transportMode" = 'shared' AND "transportSharedWithId" IS NOT NULL AND "transportPrice" = 0 AND "tenantId" IS NOT NULL AND "transportSharedWithId" <> "id") OR
  ("transportMode" <> 'shared' AND "transportSharedWithId" IS NULL)
);
CREATE INDEX "Appointment_tenantId_transportSharedWithId_idx" ON "Appointment"("tenantId", "transportSharedWithId");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_transport_shared_tenant_fkey" FOREIGN KEY ("tenantId", "transportSharedWithId") REFERENCES "Appointment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE TABLE "GroomingTransportZone" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "roundTripPrice" DECIMAL(10,2),
  "pickupPrice" DECIMAL(10,2),
  "deliveryPrice" DECIMAL(10,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GroomingTransportZone_nonnegative" CHECK (("roundTripPrice" IS NULL OR "roundTripPrice" >= 0) AND ("pickupPrice" IS NULL OR "pickupPrice" >= 0) AND ("deliveryPrice" IS NULL OR "deliveryPrice" >= 0))
);
CREATE UNIQUE INDEX "GroomingTransportZone_tenantId_name_key" ON "GroomingTransportZone"("tenantId", "name");
CREATE INDEX "GroomingTransportZone_tenantId_active_idx" ON "GroomingTransportZone"("tenantId", "active");
