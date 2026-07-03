/**
 * registerEventDelivery — operación de infraestructura, NO un caso de uso de
 * negocio (ajuste congelado en la Etapa 2: "Registrar Entrega de Evento" y
 * "Reintentar Entrega de Evento" son operaciones disparadas por el propio
 * mecanismo de entrega — sin adaptador HTTP ni actor humano en ningún punto).
 *
 * Invariante 3: cada Entrega de Evento nace ya en su estado terminal
 * ("delivered" | "failed") — nunca se persiste "pending"; la ausencia de una
 * fila sigue representando "sin intento" (Esquema Físico, nota de la Etapa 5).
 *
 * @param {Object} deps
 * @param {import("../ports/event-delivery-repository.port").EventDeliveryRepositoryPort} deps.eventDeliveryRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRegisterEventDeliveryMechanism({ eventDeliveryRepository, eventPublisher }) {
  return async function registerEventDelivery({ domainEventId, consumer, status, failureReason = null }) {
    if (status !== "delivered" && status !== "failed") {
      throw new Error('registerEventDelivery: status debe ser "delivered" o "failed" (nunca "pending").');
    }

    const delivery = await eventDeliveryRepository.create({
      domainEventId,
      consumer,
      status,
      failureReason: status === "failed" ? failureReason : null,
    });

    if (status === "failed") {
      await eventPublisher.publish("EntregaFallida", { delivery });
    }

    return { delivery };
  };
}

module.exports = { createRegisterEventDeliveryMechanism };
