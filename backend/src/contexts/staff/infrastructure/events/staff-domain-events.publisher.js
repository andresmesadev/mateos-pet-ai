const { DomainEventPublisherPort } = require("../../application/ports/domain-event-publisher.port");
const logger = require("../../../../lib/logger");

class StaffDomainEventsPublisher extends DomainEventPublisherPort {
  async publish(eventName, payload) {
    logger.info(`[Staff] Evento de dominio: ${eventName}`, {
      staffId: payload?.staff?.id ?? payload?.staffId,
    });
  }
}

module.exports = { StaffDomainEventsPublisher };
