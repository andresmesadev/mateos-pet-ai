const prisma = require("../../../../lib/prisma");
const { civilDateLabel } = require("../../../shared/business-day");

/**
 * Lectura entre contextos (precedente: CommissionReaderPort de 2.3):
 * ¿existe un Cierre del Día oficial para el día civil (ADR 008) de este instante?
 */
class PrismaDailyCloseReader {
  async findByCivilDay(tenantId, at) {
    return prisma.dailyClose.findFirst({
      where: { ...(tenantId ? { tenantId } : {}), date: civilDateLabel(at) },
    });
  }
}

module.exports = { PrismaDailyCloseReader };
