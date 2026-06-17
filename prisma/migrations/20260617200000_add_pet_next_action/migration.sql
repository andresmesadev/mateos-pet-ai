CREATE TABLE "PetNextAction" (
  "id"                  TEXT NOT NULL,
  "petId"               TEXT NOT NULL,
  "tenantId"            TEXT,
  "type"                TEXT NOT NULL,
  "notes"               TEXT,
  "dueAt"               TIMESTAMP(3) NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'pending',
  "sourceRecordId"      TEXT,
  "sourceAppointmentId" TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PetNextAction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PetNextAction"
  ADD CONSTRAINT "PetNextAction_petId_fkey"
  FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PetNextAction"
  ADD CONSTRAINT "PetNextAction_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PetNextAction_petId_status_idx" ON "PetNextAction"("petId", "status");
CREATE INDEX "PetNextAction_tenantId_status_dueAt_idx" ON "PetNextAction"("tenantId", "status", "dueAt");
