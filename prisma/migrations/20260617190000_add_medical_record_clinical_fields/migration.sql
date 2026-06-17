-- AlterTable: add clinical fields to MedicalRecord
ALTER TABLE "MedicalRecord"
  ADD COLUMN "appointmentId" TEXT,
  ADD COLUMN "staffId"       TEXT,
  ADD COLUMN "reason"        TEXT,
  ADD COLUMN "findings"      TEXT,
  ADD COLUMN "diagnosis"     TEXT,
  ADD COLUMN "treatment"     TEXT,
  ADD COLUMN "recommendations" TEXT,
  ADD COLUMN "weight"        DOUBLE PRECISION,
  ADD COLUMN "nextControlAt" TIMESTAMP(3);

-- CreateIndex: appointmentId is unique (one record per appointment)
CREATE UNIQUE INDEX "MedicalRecord_appointmentId_key" ON "MedicalRecord"("appointmentId");

-- AddForeignKey: MedicalRecord -> Appointment
ALTER TABLE "MedicalRecord"
  ADD CONSTRAINT "MedicalRecord_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: MedicalRecord -> Staff
ALTER TABLE "MedicalRecord"
  ADD CONSTRAINT "MedicalRecord_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
