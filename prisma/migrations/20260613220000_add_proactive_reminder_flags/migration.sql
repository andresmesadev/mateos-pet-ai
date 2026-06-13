-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN "groomingReminderSent" BOOLEAN NOT NULL DEFAULT false;
