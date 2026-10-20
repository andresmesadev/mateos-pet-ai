ALTER TABLE "Staff" ADD COLUMN "contractType" TEXT;
ALTER TABLE "Staff" ADD COLUMN "commissionRate" DECIMAL(5,4);
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_contract_rate_check" CHECK (CASE
  WHEN "contractType" IS NULL THEN "commissionRate" IS NULL
  WHEN "contractType" = 'fixed' THEN "commissionRate" IS NULL
  WHEN "contractType" = 'service' THEN "commissionRate" IS NOT NULL AND "commissionRate" >= 0 AND "commissionRate" <= 1
  ELSE FALSE END);
ALTER TABLE "Service" ADD COLUMN "appliesCommissionSplit" BOOLEAN;
