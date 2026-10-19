ALTER TABLE "Transaction" ALTER COLUMN "paidAt" DROP NOT NULL;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pending_only_appointment"
  CHECK ("paidAt" IS NOT NULL OR "origin" = 'system_appointment_completed');
