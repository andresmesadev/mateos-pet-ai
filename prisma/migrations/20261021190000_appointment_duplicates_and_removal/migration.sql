BEGIN;
CREATE TABLE "AppointmentBookingGuard" (
  "tenantId" TEXT NOT NULL, "petId" TEXT NOT NULL, "revision" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "AppointmentBookingGuard_pkey" PRIMARY KEY ("tenantId", "petId")
);
CREATE TABLE "AppointmentRemoval" (
  "id" TEXT NOT NULL PRIMARY KEY, "appointmentId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL, "reason" TEXT NOT NULL, "previousStatus" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL, "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_removal_values" CHECK (
    length(btrim("actorId")) > 0 AND length(btrim("actorName")) > 0
    AND "actorRole" IN ('admin', 'receptionist') AND length(btrim("reason")) BETWEEN 1 AND 500
    AND "previousStatus" IN ('pending', 'confirmed', 'arrived', 'in_progress', 'cancelled', 'no_show')
    AND jsonb_typeof("snapshot") = 'object' AND "snapshot" ? 'id' AND "snapshot" ? 'tenantId' AND "snapshot" ? 'status'
    AND "snapshot"->>'id' = "appointmentId" AND "snapshot"->>'status' = "previousStatus"
    AND "snapshot"->>'tenantId' = "tenantId"
  )
);
CREATE UNIQUE INDEX "AppointmentRemoval_appointmentId_key" ON "AppointmentRemoval" ("appointmentId");
CREATE INDEX "AppointmentRemoval_tenantId_removedAt_idx" ON "AppointmentRemoval" ("tenantId", "removedAt");
CREATE INDEX "Appointment_tenantId_petId_date_idx" ON "Appointment" ("tenantId", "petId", "date");

CREATE FUNCTION appointment_booking_type(value TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE lower(btrim(value))
    WHEN 'consultation' THEN 'vet' WHEN 'veterinary_consultation' THEN 'vet'
    WHEN 'general_appointment' THEN 'vet' WHEN 'medication' THEN 'vet'
    WHEN 'baño básico' THEN 'grooming' WHEN 'baño + corte' THEN 'grooming'
    WHEN 'baño medicado' THEN 'grooming' WHEN 'baño antipulgas' THEN 'grooming'
    WHEN 'spa canino/felino' THEN 'grooming' WHEN 'deslanado' THEN 'grooming'
    WHEN 'colorimetría' THEN 'grooming' ELSE lower(btrim(value)) END
$$;
CREATE FUNCTION appointment_guard_daily_booking() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE day_start TIMESTAMP(3); day_end TIMESTAMP(3);
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM "AppointmentRemoval" WHERE "appointmentId" = NEW.id) THEN
    RAISE EXCEPTION 'A removed appointment ID cannot be reused' USING ERRCODE = '23514', CONSTRAINT = 'appointment_removed_id';
  END IF;
  IF NEW."tenantId" IS NULL OR NEW."petId" IS NULL OR NEW.status IN ('cancelled', 'no_show') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status NOT IN ('cancelled', 'no_show')
    AND (OLD."tenantId", OLD."petId", OLD."serviceId", OLD."serviceType", OLD.date)
       IS NOT DISTINCT FROM (NEW."tenantId", NEW."petId", NEW."serviceId", NEW."serviceType", NEW.date)
  THEN RETURN NEW; END IF;
  -- A real row update also forces serialization failures for stale RR snapshots.
  INSERT INTO "AppointmentBookingGuard" ("tenantId", "petId", revision)
    VALUES (NEW."tenantId", NEW."petId", 1)
    ON CONFLICT ("tenantId", "petId") DO UPDATE SET revision = "AppointmentBookingGuard".revision + 1;
  day_start := (((NEW.date AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota')::date::timestamp
    AT TIME ZONE 'America/Bogota') AT TIME ZONE 'UTC';
  day_end := day_start + interval '1 day';
  IF EXISTS (SELECT 1 FROM "Appointment" a
    WHERE a.id <> NEW.id AND a."tenantId" = NEW."tenantId" AND a."petId" = NEW."petId"
      AND a.status NOT IN ('cancelled', 'no_show') AND a.date >= day_start AND a.date < day_end
      AND ((a."serviceId" IS NOT NULL AND NEW."serviceId" IS NOT NULL AND a."serviceId" = NEW."serviceId")
        OR ((a."serviceId" IS NULL OR NEW."serviceId" IS NULL)
          AND appointment_booking_type(a."serviceType") = appointment_booking_type(NEW."serviceType")))) THEN
    RAISE EXCEPTION 'Pet already has this service on this Colombia day'
      USING ERRCODE = '23505', CONSTRAINT = 'appointment_pet_service_day_unique';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_daily_booking BEFORE INSERT OR UPDATE OF "tenantId", "petId", "serviceId", "serviceType", date, status
  ON "Appointment" FOR EACH ROW EXECUTE FUNCTION appointment_guard_daily_booking();
CREATE FUNCTION appointment_removal_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Appointment removal audit is immutable' USING ERRCODE = '23514', CONSTRAINT = 'appointment_removal_immutable';
END $$;
CREATE TRIGGER appointment_removal_immutable BEFORE UPDATE OR DELETE ON "AppointmentRemoval"
  FOR EACH ROW EXECUTE FUNCTION appointment_removal_immutable();
COMMIT;
