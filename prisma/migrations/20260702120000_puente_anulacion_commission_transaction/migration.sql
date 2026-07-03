-- Entregable Puente — Exposición del Sistema Operativo (auditoría v2.1.0).
-- Patrón de anulación en Commission (ADR 009) y Transaction (Etapa 3-4, patrón homogéneo).
-- Las unicidades totales se reemplazan por índices únicos PARCIALES (solo filas activas):
-- especialización de las invariantes ADR 005/009, no una reducción de garantías.
-- Prisma no expresa índices parciales en el schema — viven aquí, en el historial oficial.

-- DropIndex
DROP INDEX "Commission_appointmentId_key";

-- DropIndex
DROP INDEX "Transaction_appointmentId_origin_key";

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "replacesCommissionId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "replacesTransactionId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- CreateIndex (búsquedas; reemplazan lo que las unicidades totales daban gratis)
CREATE INDEX "Commission_appointmentId_idx" ON "Commission"("appointmentId");

-- CreateIndex
CREATE INDEX "Transaction_appointmentId_origin_idx" ON "Transaction"("appointmentId", "origin");

-- Invariantes reales (ADR 005/009): como máximo UNA fila ACTIVA por cita (y por origen).
CREATE UNIQUE INDEX "Commission_appointmentId_active_key"
  ON "Commission"("appointmentId") WHERE "status" = 'active';

CREATE UNIQUE INDEX "Transaction_appointmentId_origin_active_key"
  ON "Transaction"("appointmentId", "origin") WHERE "status" = 'active';

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_replacesTransactionId_fkey" FOREIGN KEY ("replacesTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_replacesCommissionId_fkey" FOREIGN KEY ("replacesCommissionId") REFERENCES "Commission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
