CREATE TABLE "StaffCredential" (
    "staffId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCredential_pkey" PRIMARY KEY ("staffId")
);

CREATE UNIQUE INDEX "StaffCredential_email_key" ON "StaffCredential"("email");

ALTER TABLE "StaffCredential" ADD CONSTRAINT "StaffCredential_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedicalRecord" ADD COLUMN "createdByStaffId" TEXT;
ALTER TABLE "MedicalRecord" ADD COLUMN "updatedByStaffId" TEXT;

CREATE INDEX "MedicalRecord_createdByStaffId_idx" ON "MedicalRecord"("createdByStaffId");
CREATE INDEX "MedicalRecord_updatedByStaffId_idx" ON "MedicalRecord"("updatedByStaffId");

ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_createdByStaffId_fkey"
    FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_updatedByStaffId_fkey"
    FOREIGN KEY ("updatedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
