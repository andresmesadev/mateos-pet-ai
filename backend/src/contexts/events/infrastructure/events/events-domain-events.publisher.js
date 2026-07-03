const { DomainEventPublisherPort } = require("../../application/ports/domain-event-publisher.port");
const logger = require("../../../../lib/logger");

/**
 * Implementación inicial: registra el evento para auditoría/observabilidad.
 * Mismo patrón que los publishers de Finanzas/Staff/Servicios — no hay
 * todavía un bus de eventos entre contextos externo a Eventos (Automatizaciones
 * es 3.3, fuera de alcance de este entregable).
 */
class EventsDomainEventsPublisher extends DomainEventPublisherPort {
  async publish(eventName, payload) {
    logger.info(`[Eventos] Evento de dominio: ${eventName}`, {
      id: payload?.eventType?.id ?? payload?.domainEvent?.id ?? payload?.delivery?.id,
    });
  }
}

module.exports = { EventsDomainEventsPublisher };
