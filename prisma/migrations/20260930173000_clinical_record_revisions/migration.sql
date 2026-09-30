ALTER TABLE "MedicalRecord" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "MedicalRecordRevision" (
  "id" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorStaffId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicalRecordRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MedicalRecordRevision_recordId_version_key" ON "MedicalRecordRevision"("recordId", "version");
CREATE INDEX "MedicalRecordRevision_recordId_createdAt_idx" ON "MedicalRecordRevision"("recordId", "createdAt");
ALTER TABLE "MedicalRecordRevision" ADD CONSTRAINT "MedicalRecordRevision_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
