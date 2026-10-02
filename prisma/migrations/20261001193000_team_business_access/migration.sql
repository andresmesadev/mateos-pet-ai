ALTER TABLE "Staff" ADD COLUMN "accessPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Transaction"
  ADD COLUMN "recordedActorId" TEXT,
  ADD COLUMN "recordedActorName" TEXT,
  ADD COLUMN "recordedActorRole" TEXT;
ALTER TABLE "Appointment"
  ADD COLUMN "priceActorId" TEXT,
  ADD COLUMN "priceActorName" TEXT,
  ADD COLUMN "priceActorRole" TEXT;
ALTER TABLE "TransactionItem" ADD COLUMN "itemKind" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "Pet" ADD COLUMN "operationalAlerts" TEXT;
