-- Entregable 3.1 — Comunicación (Fase 3).
-- Diseño congelado: docs/architecture/technical-design/comunicacion-esquema-fisico.md

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'activa';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'cliente';

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_tenantId_type_key" ON "Channel"("tenantId", "type");

-- Nota de implementación (Etapa 5, congelada en su aprobación): el índice
-- anterior no protege tenantId = NULL (Postgres no colisiona NULLs). Se
-- añade el índice único parcial que garantiza un único canal GLOBAL por tipo.
CREATE UNIQUE INDEX "Channel_type_global_key" ON "Channel"("type") WHERE "tenantId" IS NULL;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill determinista (Etapa 5, plan de migración): ningún Message
-- histórico pudo ser "sistema" — las notificaciones nunca se persistieron.
UPDATE "Message" SET "origin" = 'agente' WHERE "role" = 'assistant';
UPDATE "Message" SET "origin" = 'cliente' WHERE "role" = 'user';

-- Backfill dirigido: sessionData.requires_human_attention = true pasa
-- explícitamente a status = "esperando_humano". sessionData no se modifica.
UPDATE "Conversation"
SET "status" = 'esperando_humano'
WHERE ("sessionData" -> 'requires_human_attention')::text = 'true';
