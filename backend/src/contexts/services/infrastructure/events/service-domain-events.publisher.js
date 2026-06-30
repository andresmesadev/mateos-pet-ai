const { DomainEventPublisherPort } = require("../../application/ports/domain-event-publisher.port");
const logger = require("../../../../lib/logger");

/**
 * Implementación inicial: registra el evento para auditoría/observabilidad.
 * No hay todavía un bus de eventos entre contextos (Automatizaciones es
 * Fase 3, fuera de alcance). Agenda, al integrarse, puede empezar a
 * suscribirse aquí sin que esta clase cambie su contrato (publish(name, payload)).
 */
class ServiceDomainEventsPublisher extends DomainEventPublisherPort {
  async publish(eventName, payload) {
    logger.info(`[Servicios] Evento de dominio: ${eventName}`, {
      serviceId: payload?.service?.id,
    });
  }
}

module.exports = { ServiceDomainEventsPublisher };
