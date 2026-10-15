-- Design approved 2026-10-14; additive storage, no business backfill.
-- CreateTable
CREATE TABLE "OperationalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "requestId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "canonicalVersion" INTEGER NOT NULL,
    "inputMode" VARCHAR(16) NOT NULL,
    "canonicalInput" JSONB NOT NULL,
    "inputHash" CHAR(64) NOT NULL,
    "state" VARCHAR(24) NOT NULL DEFAULT 'pendiente',
    "claimGeneration" BIGINT NOT NULL DEFAULT 0,
    "claimOwner" UUID,
    "claimUntil" TIMESTAMPTZ(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "resultCode" VARCHAR(64),
    "result" JSONB,
    "lastErrorCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperationalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "requestId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "currentRevision" INTEGER NOT NULL,
    "executionKey" UUID NOT NULL,
    "terminalReason" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OperationalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRevision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "actionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "canonicalVersion" INTEGER NOT NULL,
    "validationState" VARCHAR(16) NOT NULL,
    "payload" JSONB NOT NULL,
    "missingFields" JSONB NOT NULL,
    "preview" JSONB NOT NULL,
    "productContext" JSONB,
    "payloadHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "ActionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "actionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "executionKey" UUID NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "decisionId" TEXT NOT NULL,
    "expenseId" TEXT,
    "inventoryOperationId" TEXT,
    "actorName" VARCHAR(160) NOT NULL,
    "actorRole" VARCHAR(32) NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExecutionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationIntent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "principalKey" VARCHAR(256) NOT NULL,
    "requestId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "receiptId" TEXT,
    "causeKey" VARCHAR(200) NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "eventName" VARCHAR(100) NOT NULL,
    "origin" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "canonicalVersion" INTEGER NOT NULL,
    "envelopeHash" CHAR(64) NOT NULL,
    "certificationState" VARCHAR(24) NOT NULL DEFAULT 'pendiente',
    "domainEventId" TEXT,
    "claimGeneration" BIGINT NOT NULL DEFAULT 0,
    "claimOwner" UUID,
    "claimUntil" TIMESTAMPTZ(3),
    "certificationTries" BIGINT NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL,
    "certificationError" VARCHAR(80),
    "certifiedAt" TIMESTAMPTZ(3),
    "notificationState" VARCHAR(24) NOT NULL DEFAULT 'no_iniciada',
    "notificationId" UUID,
    "notificationStarted" TIMESTAMPTZ(3),
    "notificationEnded" TIMESTAMPTZ(3),
    "notificationCode" VARCHAR(80),
    "notificationEvidence" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PublicationIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OR_task_key" ON "OperationalRequest"("taskId");

-- CreateIndex
CREATE INDEX "OR_owner_page_idx" ON "OperationalRequest"("tenantId", "principalKey", "createdAt", "id");

-- CreateIndex
CREATE INDEX "OR_claim_idx" ON "OperationalRequest"("state", "claimUntil", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OR_request_key" ON "OperationalRequest"("tenantId", "principalKey", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "OR_scope_task_key" ON "OperationalRequest"("tenantId", "principalKey", "id", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "OA_request_key" ON "OperationalAction"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "OA_execution_key" ON "OperationalAction"("executionKey");

-- CreateIndex
CREATE INDEX "OA_owner_page_idx" ON "OperationalAction"("tenantId", "principalKey", "state", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OA_scope_key" ON "OperationalAction"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OA_receipt_scope_key" ON "OperationalAction"("tenantId", "principalKey", "id", "taskId", "kind");

-- CreateIndex
CREATE INDEX "AR_expiry_idx" ON "ActionRevision"("validationState", "expiresAt", "actionId");

-- CreateIndex
CREATE UNIQUE INDEX "AR_number_key" ON "ActionRevision"("tenantId", "principalKey", "actionId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ER_action_key" ON "ExecutionReceipt"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "ER_execution_key" ON "ExecutionReceipt"("executionKey");

-- CreateIndex
CREATE UNIQUE INDEX "ER_decision_key" ON "ExecutionReceipt"("decisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ER_expense_key" ON "ExecutionReceipt"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "ER_inventory_key" ON "ExecutionReceipt"("inventoryOperationId");

-- CreateIndex
CREATE INDEX "ER_owner_page_idx" ON "ExecutionReceipt"("tenantId", "principalKey", "confirmedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ER_scope_key" ON "ExecutionReceipt"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PI_event_key" ON "PublicationIntent"("domainEventId");

-- CreateIndex
CREATE UNIQUE INDEX "PI_notification_key" ON "PublicationIntent"("notificationId");

-- CreateIndex
CREATE INDEX "PI_certify_idx" ON "PublicationIntent"("certificationState", "nextAttemptAt", "claimUntil", "id");

-- CreateIndex
CREATE INDEX "PI_notify_idx" ON "PublicationIntent"("notificationState", "certifiedAt", "id");

-- CreateIndex
CREATE INDEX "PI_owner_idx" ON "PublicationIntent"("tenantId", "principalKey", "requestId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PI_emission_key" ON "PublicationIntent"("requestId", "causeKey", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "IO_principal_id_key" ON "InventoryOperation"("tenantId", "principalKey", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_tenant_id_key" ON "Expense"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Event_tenant_id_key" ON "DomainEvent"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DE_tenant_id_key" ON "DigitalEmployee"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AT_employee_id_key" ON "AgentTask"("digitalEmployeeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AD_task_id_key" ON "AgentDecision"("agentTaskId", "id");

-- AddForeignKey
ALTER TABLE "OperationalRequest" ADD CONSTRAINT "OperationalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperationalRequest" ADD CONSTRAINT "OperationalRequest_tenantId_employeeId_fkey" FOREIGN KEY ("tenantId", "employeeId") REFERENCES "DigitalEmployee"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperationalRequest" ADD CONSTRAINT "OperationalRequest_employeeId_taskId_fkey" FOREIGN KEY ("employeeId", "taskId") REFERENCES "AgentTask"("digitalEmployeeId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperationalAction" ADD CONSTRAINT "OperationalAction_tenantId_principalKey_requestId_taskId_fkey" FOREIGN KEY ("tenantId", "principalKey", "requestId", "taskId") REFERENCES "OperationalRequest"("tenantId", "principalKey", "id", "taskId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OperationalAction" ADD CONSTRAINT "OA_current_revision_fk" FOREIGN KEY ("tenantId", "principalKey", "id", "currentRevision") REFERENCES "ActionRevision"("tenantId", "principalKey", "actionId", "number") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ActionRevision" ADD CONSTRAINT "ActionRevision_tenantId_principalKey_actionId_fkey" FOREIGN KEY ("tenantId", "principalKey", "actionId") REFERENCES "OperationalAction"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ExecutionReceipt_tenantId_principalKey_actionId_taskId_kin_fkey" FOREIGN KEY ("tenantId", "principalKey", "actionId", "taskId", "kind") REFERENCES "OperationalAction"("tenantId", "principalKey", "id", "taskId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ExecutionReceipt_tenantId_principalKey_actionId_revisionNu_fkey" FOREIGN KEY ("tenantId", "principalKey", "actionId", "revisionNumber") REFERENCES "ActionRevision"("tenantId", "principalKey", "actionId", "number") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ExecutionReceipt_taskId_decisionId_fkey" FOREIGN KEY ("taskId", "decisionId") REFERENCES "AgentDecision"("agentTaskId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ExecutionReceipt_tenantId_expenseId_fkey" FOREIGN KEY ("tenantId", "expenseId") REFERENCES "Expense"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ExecutionReceipt_tenantId_principalKey_inventoryOperationI_fkey" FOREIGN KEY ("tenantId", "principalKey", "inventoryOperationId") REFERENCES "InventoryOperation"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PublicationIntent" ADD CONSTRAINT "PublicationIntent_tenantId_principalKey_requestId_taskId_fkey" FOREIGN KEY ("tenantId", "principalKey", "requestId", "taskId") REFERENCES "OperationalRequest"("tenantId", "principalKey", "id", "taskId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PublicationIntent" ADD CONSTRAINT "PublicationIntent_tenantId_principalKey_receiptId_fkey" FOREIGN KEY ("tenantId", "principalKey", "receiptId") REFERENCES "ExecutionReceipt"("tenantId", "principalKey", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PublicationIntent" ADD CONSTRAINT "PublicationIntent_tenantId_domainEventId_fkey" FOREIGN KEY ("tenantId", "domainEventId") REFERENCES "DomainEvent"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
