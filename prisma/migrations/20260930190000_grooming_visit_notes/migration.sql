ALTER TABLE "Appointment"
  ADD COLUMN "groomingNotes" TEXT,
  ADD COLUMN "groomingNotesVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "groomingNotesUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "groomingDeliveredAt" TIMESTAMP(3);
