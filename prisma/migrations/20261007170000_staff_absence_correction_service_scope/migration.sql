ALTER TABLE "Staff" ADD COLUMN "serviceScope" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_serviceScope_valid" CHECK ("serviceScope" IN ('auto', 'role', 'selected'));

ALTER TABLE "StaffAvailability"
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidReason" TEXT,
ADD COLUMN "voidedBy" TEXT,
ADD COLUMN "replacesId" TEXT;

CREATE UNIQUE INDEX "StaffAvailability_replacesId_key" ON "StaffAvailability"("replacesId");
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_replacesId_fkey"
FOREIGN KEY ("replacesId") REFERENCES "StaffAvailability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_void_metadata_valid" CHECK (
  ("voidedAt" IS NULL AND "voidReason" IS NULL AND "voidedBy" IS NULL)
  OR ("voidedAt" IS NOT NULL AND "type" IN ('planned_absence', 'unplanned_absence')
      AND "voidReason" IS NOT NULL AND length(btrim("voidReason")) BETWEEN 1 AND 1000
      AND "voidedBy" IS NOT NULL AND length(btrim("voidedBy")) BETWEEN 1 AND 254)
);
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_replacement_valid" CHECK (
  "replacesId" IS NULL OR ("replacesId" <> "id" AND "type" IN ('planned_absence', 'unplanned_absence'))
);
