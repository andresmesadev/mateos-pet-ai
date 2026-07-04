-- Entregable 3.3 (Fase 3) — Automatizaciones
-- Diseño congelado: docs/architecture/technical-design/automatizaciones-esquema-fisico.md

-- CreateTable
CREATE TABLE "AutomationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEventTypeId" TEXT NOT NULL,
    "defaultCondition" JSONB,
    "defaultActionType" TEXT NOT NULL,
    "defaultActionConfig" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "triggerEventTypeId" TEXT NOT NULL,
    "condition" JSONB,
    "actionType" TEXT NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "automationRuleId" TEXT NOT NULL,
    "domainEventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actionResult" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationTemplate_name_key" ON "AutomationTemplate"("name");

-- CreateIndex
CREATE INDEX "AutomationTemplate_triggerEventTypeId_idx" ON "AutomationTemplate"("triggerEventTypeId");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_active_idx" ON "AutomationRule"("tenantId", "active");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerEventTypeId_active_idx" ON "AutomationRule"("triggerEventTypeId", "active");

-- CreateIndex
CREATE INDEX "AutomationExecution_automationRuleId_createdAt_idx" ON "AutomationExecution"("automationRuleId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationExecution_domainEventId_idx" ON "AutomationExecution"("domainEventId");

-- AddForeignKey
ALTER TABLE "AutomationTemplate" ADD CONSTRAINT "AutomationTemplate_triggerEventTypeId_fkey" FOREIGN KEY ("triggerEventTypeId") REFERENCES "EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_triggerEventTypeId_fkey" FOREIGN KEY ("triggerEventTypeId") REFERENCES "EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AutomationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "AutomationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_domainEventId_fkey" FOREIGN KEY ("domainEventId") REFERENCES "DomainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
