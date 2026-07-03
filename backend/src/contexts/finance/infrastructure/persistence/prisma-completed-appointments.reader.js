const prisma = require("../../../../lib/prisma");

/**
 * Lectura puntual de consistencia sobre Agenda (ADR 007-D2) — puerto de
 * lectura, no una dependencia estructural; precedente: CommissionReaderPort.
 */
class PrismaCompletedAppointmentsReader {
  async listCompletedInRange(tenantId, dateStart, dateEnd) {
    return prisma.appointment.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: "completed",
        endedAt: { gte: dateStart, lt: dateEnd },
      },
      select: { id: true },
    });
  }

  async findById(tenantId, appointmentId) {
    return prisma.appointment.findFirst({
      where: { id: appointmentId, ...(tenantId ? { tenantId } : {}) },
      select: { id: true, status: true },
    });
  }
}

module.exports = { PrismaCompletedAppointmentsReader };
