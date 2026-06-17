ALTER TABLE "Tenant" ADD COLUMN "description" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "address" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "businessHours" JSONB;
ALTER TABLE "Service" ADD COLUMN "basePrice" DECIMAL(10,2);
