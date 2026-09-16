-- 8.2 introduced this table through schema synchronization, without a migration.
-- Support both those installations and databases built from migration history.
CREATE TABLE IF NOT EXISTS "InboundJob" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "claimedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboundJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InboundJob_provider_providerEventId_key" ON "InboundJob"("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "InboundJob_status_createdAt_idx" ON "InboundJob"("status", "createdAt");

ALTER TABLE "InboundJob"
    ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN "replies" JSONB,
    ADD COLUMN "replyCursor" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

-- Stop old workers before applying this migration. Legacy attempts have no
-- checkpoint proving which effects already occurred; never replay them blindly.
UPDATE "InboundJob"
SET "status" = 'needs_review', "phase" = 'processing',
    "lastError" = 'LEGACY_UNCERTAIN: reconcile prior effects before any replay',
    "finishedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'claimed' OR ("status" = 'received' AND "attempts" > 0);
UPDATE "InboundJob" SET "phase" = 'complete' WHERE "status" = 'done';

CREATE INDEX "InboundJob_status_nextAttemptAt_createdAt_idx" ON "InboundJob"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "InboundJob_status_leaseExpiresAt_idx" ON "InboundJob"("status", "leaseExpiresAt");
