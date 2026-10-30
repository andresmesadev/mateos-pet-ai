-- Additive only: no business credentials or quota allocations are backfilled.
CREATE UNIQUE INDEX "Channel_tenantId_id_key" ON "Channel"("tenantId", "id");
CREATE TABLE "WhatsAppConnection" (
  "id" UUID PRIMARY KEY, "tenantId" TEXT NOT NULL UNIQUE, "channelId" TEXT NOT NULL UNIQUE,
  "wabaId" VARCHAR(64) NOT NULL UNIQUE, "phoneNumberId" VARCHAR(64) NOT NULL UNIQUE,
  "displayPhone" VARCHAR(64), "status" VARCHAR(16) NOT NULL,
  "encryptedToken" TEXT, "tokenExpiresAt" TIMESTAMPTZ(3), "routeVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WAC_status_check" CHECK ("status" IN ('enabled','revoked')),
  CONSTRAINT "WAC_revision_check" CHECK ("routeVersion" > 0),
  CONSTRAINT "WAC_enabled_secret_check" CHECK ("status" <> 'enabled' OR "encryptedToken" IS NOT NULL),
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("tenantId", "channelId") REFERENCES "Channel"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "WhatsAppConnection_tenantId_channelId_key" ON "WhatsAppConnection"("tenantId","channelId");
CREATE TABLE "WhatsAppConnectionChallenge" (
  "id" UUID PRIMARY KEY, "tenantId" TEXT NOT NULL, "stateHash" CHAR(64) NOT NULL UNIQUE,
  "actorHash" CHAR(64) NOT NULL, "status" VARCHAR(16) NOT NULL,
  "expectedRouteVersion" INTEGER NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "consumedAt" TIMESTAMPTZ(3),
  CHECK ("status" IN ('pending','exchanging','completed','failed')),
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WhatsAppConnectionChallenge_tenantId_expiresAt_idx" ON "WhatsAppConnectionChallenge"("tenantId","expiresAt");
CREATE TABLE "AiQuotaConfig" (
  "tenantId" TEXT PRIMARY KEY, "monthlyLimit" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CHECK ("monthlyLimit" BETWEEN 0 AND 1000000000),
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "AiQuotaPeriod" (
  "id" UUID PRIMARY KEY, "tenantId" TEXT NOT NULL, "monthKey" VARCHAR(7) NOT NULL,
  "quotaLimit" INTEGER NOT NULL, "usedUnits" INTEGER NOT NULL DEFAULT 0,
  "reservedUnits" INTEGER NOT NULL DEFAULT 0, "policyVersion" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AQP_limits_check" CHECK ("quotaLimit" BETWEEN 0 AND 1000000000 AND "usedUnits" >= 0 AND "reservedUnits" >= 0 AND "usedUnits" + "reservedUnits" <= "quotaLimit"),
  CONSTRAINT "AQP_month_check" CHECK ("monthKey" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiQuotaPeriod_tenantId_monthKey_key" ON "AiQuotaPeriod"("tenantId","monthKey");
CREATE UNIQUE INDEX "AiQuotaPeriod_tenantId_id_key" ON "AiQuotaPeriod"("tenantId","id");
CREATE TABLE "AiUsageEntry" (
  "id" UUID PRIMARY KEY, "tenantId" TEXT NOT NULL, "periodId" UUID NOT NULL,
  "operationKey" VARCHAR(128) NOT NULL, "operation" VARCHAR(32) NOT NULL,
  "units" INTEGER NOT NULL, "state" VARCHAR(16) NOT NULL, "providerUsage" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "settledAt" TIMESTAMPTZ(3),
  CHECK ("units" > 0), CHECK ("state" IN ('reserved','accepted','rejected','uncertain')),
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("tenantId","periodId") REFERENCES "AiQuotaPeriod"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiUsageEntry_tenantId_operationKey_key" ON "AiUsageEntry"("tenantId","operationKey");
CREATE INDEX "AiUsageEntry_tenantId_createdAt_idx" ON "AiUsageEntry"("tenantId","createdAt");
CREATE TABLE "AiQuotaChange" (
  "id" UUID PRIMARY KEY, "tenantId" TEXT NOT NULL, "actorHash" CHAR(64) NOT NULL,
  "previousLimit" INTEGER NOT NULL, "newLimit" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("previousLimit" BETWEEN 0 AND 1000000000 AND "newLimit" BETWEEN 0 AND 1000000000),
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AiQuotaChange_tenantId_createdAt_idx" ON "AiQuotaChange"("tenantId","createdAt");
ALTER TABLE "InboundJob" ADD COLUMN "providerRoute" JSONB;
