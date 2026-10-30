CREATE TABLE "WhatsAppConnectionEvent" (
  "id" UUID PRIMARY KEY, "tenantId" TEXT NOT NULL,
  "action" VARCHAR(16) NOT NULL, "routeVersion" INTEGER NOT NULL,
  "actorHash" CHAR(64) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("action" IN ('connected','reconnected','disconnected')),
  CHECK ("routeVersion" > 0),
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WhatsAppConnectionEvent_tenantId_createdAt_idx" ON "WhatsAppConnectionEvent"("tenantId","createdAt");
