/**
 * Puerto hacia el mecanismo de Entrega de Evento de Eventos (3.0). Automatizaciones
 * es su primer consumidor real (Etapa 1, Decisión 6) — resuelve la Decisión
 * Diferida que 3.0 dejó abierta. La implementación de infraestructura satisface
 * este puerto con `events.registerEventDelivery` (composition root de Eventos).
 */
class EventDeliveryPort {
  async register(_data) {
    throw new Error("EventDeliveryPort.register no implementado");
  }
}
module.exports = { EventDeliveryPort };
