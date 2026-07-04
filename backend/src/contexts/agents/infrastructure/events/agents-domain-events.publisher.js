const { DomainEventPublisherPort } = require("../../application/ports/domain-event-publisher.port");
const logger = require("../../../../lib/logger");

/**
 * Implementación inicial: registra el evento para auditoría/observabilidad.
 * Mismo patrón que los publishers de Finanzas/Staff/Servicios/Eventos/Comunicación
 * — sin integración obligatoria con el contexto Eventos en este entregable
 * (Etapa 3, sección 3: sin dependencia de Comunicación ni Eventos).
 */
class AgentsDomainEventsPublisher extends DomainEventPublisherPort {
  async publish(eventName, payload) {
    logger.info(`[Empleados Digitales] Evento de dominio: ${eventName}`, {
      id:
        payload?.digitalEmployee?.id ??
        payload?.task?.id ??
        payload?.decision?.id ??
        payload?.escalation?.id ??
        payload?.limit?.id ??
        payload?.digitalEmployeeId,
    });
  }
}

module.exports = { AgentsDomainEventsPublisher };
