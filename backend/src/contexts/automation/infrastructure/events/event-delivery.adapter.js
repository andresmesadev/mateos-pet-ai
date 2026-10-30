const { EventDeliveryPort } = require("../../application/ports/event-delivery.port");

/**
 * Satisface EventDeliveryPort delegando en el mecanismo real de Eventos
 * (`events.registerEventDelivery`, 3.0) — Automatizaciones es su primer
 * consumidor real (Etapa 1, Decisión 6).
 */
class EventsRegisterEventDeliveryAdapter extends EventDeliveryPort {
  constructor({ registerEventDelivery }) {
    super();
    this.registerEventDelivery = registerEventDelivery;
  }

  async register({ domainEventId, consumer, status, failureReason = null }, ctx) {
    return this.registerEventDelivery({ domainEventId, consumer, status, failureReason }, ctx);
  }
}

module.exports = { EventsRegisterEventDeliveryAdapter };
