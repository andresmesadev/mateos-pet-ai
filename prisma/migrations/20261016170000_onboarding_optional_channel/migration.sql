-- Dashboard registration does not require a WhatsApp channel.
-- Existing identifiers and their unique index remain unchanged.
ALTER TABLE "Tenant" ALTER COLUMN "phone" DROP NOT NULL;
