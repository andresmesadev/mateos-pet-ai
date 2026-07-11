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

  // Entregable 5.1 — Outbox de Eventos de Dominio. Volumen real hoy: 0 filas
  // en producción (confirmado en la auditoría de Macroetapa 1) — se resuelve
  // en memoria (última entrega por domainEventId), sin agregación SQL, hasta
  // que el volumen real justifique optimizarlo.
  async findDomainEventsAwaitingRetry(consumer) {
    const deliveries = await prisma.eventDelivery.findMany({
      where: { consumer },
      orderBy: { createdAt: "desc" },
      include: { domainEvent: true },
    });

    const seen = new Set();
    const pending = [];
    for (const delivery of deliveries) {
      if (seen.has(delivery.domainEventId)) continue;
      seen.add(delivery.domainEventId);
      if (delivery.status === "failed") {
        pending.push(delivery.domainEvent);
      }
    }
    return pending;
  }
}

module.exports = { PrismaEventDeliveryRepository };
