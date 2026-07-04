const { DomainEventPublisherPort } = require("../../application/ports/domain-event-publisher.port");
const logger = require("../../../../lib/logger");

/**
 * Implementación inicial: registra el evento para auditoría/observabilidad.
 * Mismo patrón que los publishers de Finanzas/Staff/Servicios/Eventos/
 * Comunicación/Empleados Digitales.
 */
class AutomationDomainEventsPublisher extends DomainEventPublisherPort {
  async publish(eventName, payload) {
    logger.info(`[Automatizaciones] Evento de dominio: ${eventName}`, {
      id: payload?.rule?.id ?? payload?.template?.id,
    });
  }
}

module.exports = { AutomationDomainEventsPublisher };
