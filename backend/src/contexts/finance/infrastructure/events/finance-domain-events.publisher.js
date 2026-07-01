const { DomainEventPublisherPort } = require("../../application/ports/domain-event-publisher.port");
const logger = require("../../../../lib/logger");

class FinanceDomainEventsPublisher extends DomainEventPublisherPort {
  async publish(eventName, payload) {
    logger.info(`[Finance] Evento de dominio: ${eventName}`, {
      id: payload?.expense?.id ?? payload?.transaction?.id ?? payload?.dailyClose?.id ?? payload?.financialPeriod?.id,
    });
  }
}

module.exports = { FinanceDomainEventsPublisher };
