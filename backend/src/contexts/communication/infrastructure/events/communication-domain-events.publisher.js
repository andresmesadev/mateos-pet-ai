const { DomainEventPublisherPort } = require("../../application/ports/domain-event-publisher.port");
const logger = require("../../../../lib/logger");

/**
 * Implementación inicial: registra el evento para auditoría/observabilidad.
 * Mismo patrón que los publishers de Finanzas/Staff/Servicios/Eventos — sin
 * integración obligatoria con el contexto Eventos en este entregable
 * (Decisión Diferida 4).
 */
class CommunicationDomainEventsPublisher extends DomainEventPublisherPort {
  async publish(eventName, payload) {
    logger.info(`[Comunicación] Evento de dominio: ${eventName}`, {
      id: payload?.channel?.id ?? payload?.message?.id ?? payload?.conversation?.id,
    });
  }
}

module.exports = { CommunicationDomainEventsPublisher };
