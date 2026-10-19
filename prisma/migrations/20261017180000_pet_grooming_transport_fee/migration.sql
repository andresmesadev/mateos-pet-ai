ALTER TABLE "Pet" ADD COLUMN "defaultGroomingTransportPrice" DECIMAL(10,2);
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_grooming_transport_fee_nonnegative"
  CHECK ("defaultGroomingTransportPrice" IS NULL OR "defaultGroomingTransportPrice" >= 0);
