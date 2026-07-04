-- Entregable 3.2 (Fase 3) — Empleados Digitales
-- Diseño congelado: docs/architecture/technical-design/empleado-digital-esquema-fisico.md

-- CreateTable
CREATE TABLE "DigitalEmployee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "specialization" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAutonomyLimit" (
    "id" TEXT NOT NULL,
    "digitalEmployeeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AgentAutonomyLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "digitalEmployeeId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_proceso',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL,
    "agentTaskId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "agentTaskId" TEXT NOT NULL,
    "assignedStaffId" TEXT,
    "context" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DigitalEmployee_tenantId_specialization_idx" ON "DigitalEmployee"("tenantId", "specialization");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAutonomyLimit_digitalEmployeeId_action_key" ON "AgentAutonomyLimit"("digitalEmployeeId", "action");

-- CreateIndex
CREATE INDEX "AgentTask_digitalEmployeeId_status_idx" ON "AgentTask"("digitalEmployeeId", "status");

-- CreateIndex
CREATE INDEX "AgentDecision_agentTaskId_idx" ON "AgentDecision"("agentTaskId");

-- CreateIndex
CREATE INDEX "Escalation_status_idx" ON "Escalation"("status");

-- CreateIndex
CREATE INDEX "Escalation_assignedStaffId_status_idx" ON "Escalation"("assignedStaffId", "status");

-- AddForeignKey
ALTER TABLE "DigitalEmployee" ADD CONSTRAINT "DigitalEmployee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAutonomyLimit" ADD CONSTRAINT "AgentAutonomyLimit_digitalEmployeeId_fkey" FOREIGN KEY ("digitalEmployeeId") REFERENCES "DigitalEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_digitalEmployeeId_fkey" FOREIGN KEY ("digitalEmployeeId") REFERENCES "DigitalEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_agentTaskId_fkey" FOREIGN KEY ("agentTaskId") REFERENCES "AgentTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_agentTaskId_fkey" FOREIGN KEY ("agentTaskId") REFERENCES "AgentTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
