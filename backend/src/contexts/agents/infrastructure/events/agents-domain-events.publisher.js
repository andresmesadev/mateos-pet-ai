const { DomainEventPublisherPort } = require("../../application/ports/domain-event-publisher.port");
const { CertifyingDomainEventPublisher } = require("../../../shared/events/certifying-domain-event-publisher");

/**
 * Entregable 5.2 — Certificación Real de Eventos por Contexto: delega en el
 * adaptador reutilizable (certifying-domain-event-publisher.js) en vez de
 * solo registrar por logger. Mismo contrato de puerto, sin cambios en los
 * casos de uso que lo consumen.
 */
class AgentsDomainEventsPublisher extends DomainEventPublisherPort {
  constructor({ registerDomainEvent }) {
    super();
    this.delegate = new CertifyingDomainEventPublisher({ registerDomainEvent, originContext: "Empleados Digitales" });
  }

  async publish(eventName, payload) {
    return this.delegate.publish(eventName, payload);
  }
}

module.exports = { AgentsDomainEventsPublisher };
