const prisma = require("../../../../lib/prisma");
const { EventDeliveryRepositoryPort } = require("../../application/ports/event-delivery-repository.port");

class PrismaEventDeliveryRepository extends EventDeliveryRepositoryPort {
  async create(data) {
    return prisma.eventDelivery.create({ data });
  }

  async listByDomainEvent(domainEventId) {
    return prisma.eventDelivery.findMany({
      where: { domainEventId },
      orderBy: { createdAt: "asc" },
    });
  }

  // Soporte del reintento: la última entrega fallida para ese consumidor,
  // sin que exista ya una entrega exitosa posterior (Invariante 3: nunca se
  // reescribe; el reintento solo aplica mientras el último intento conocido
  // haya sido un fallo).
  async findLastFailedForConsumer(domainEventId, consumer) {
    const last = await prisma.eventDelivery.findFirst({
      where: { domainEventId, consumer },
      orderBy: { createdAt: "desc" },
    });
    return last && last.status === "failed" ? last : null;
  }
}

module.exports = { PrismaEventDeliveryRepository };
