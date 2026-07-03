const prisma = require("../../../../lib/prisma");
const { AppointmentRepositoryPort } = require("../../application/ports/appointment-repository.port");

class PrismaAppointmentRepository extends AppointmentRepositoryPort {
  async findById(tenantId, appointmentId) {
    return prisma.appointment.findFirst({
      where: { id: appointmentId, ...(tenantId ? { tenantId } : {}) },
      include: {
        pet: { select: { defaultGroomingPrice: true } },
        service: { select: { id: true, basePrice: true, category: { select: { id: true, name: true } } } },
      },
    });
  }

  async markCompleted(appointmentId, endedAt, ctx) {
    const client = ctx?.tx ?? prisma;
    return client.appointment.update({
      where: { id: appointmentId },
      data: { status: "completed", endedAt },
    });
  }
}

module.exports = { PrismaAppointmentRepository };
