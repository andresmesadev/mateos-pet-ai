/**
 * Puerto — publicación de eventos de dominio. El mecanismo real (bus en
 * memoria, cola, etc.) es una decisión de infraestructura; la aplicación
 * solo declara "este evento ocurrió" después de confirmar la persistencia.
 *
 * Implementación real: infrastructure/events/service-domain-events.publisher.js
 */
class DomainEventPublisherPort {
  /** @param {string} eventName @param {Object} payload */
  async publish(_eventName, _payload) {
    throw new Error("DomainEventPublisherPort.publish no implementado");
  }
}

module.exports = { DomainEventPublisherPort };
