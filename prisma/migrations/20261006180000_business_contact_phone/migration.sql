-- Separate the editable business contact from the inbound WhatsApp identifier.
-- Existing establishments intentionally remain without a contact phone.
ALTER TABLE "Tenant" ADD COLUMN "contactPhone" VARCHAR(16);
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_contactPhone_format_check"
  CHECK ("contactPhone" IS NULL OR "contactPhone" ~ '^\+?[0-9]{7,15}$');
