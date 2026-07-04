/**
 * Puerto de solo lectura hacia el Catálogo de Tipos de Evento (Eventos, 3.0).
 * Automatizaciones referencia `EventType` como dato de catálogo compartido —
 * no invoca ningún caso de uso ni lógica interna del contexto Eventos
 * (Etapa 3, sección 3: la dependencia hacia Eventos es de lectura de catálogo
 * y escritura de Entrega de Evento, nunca de su lógica interna).
 */
class EventTypeLookupPort {
  async findActiveByName(_name) {
    throw new Error("EventTypeLookupPort.findActiveByName no implementado");
  }
}
module.exports = { EventTypeLookupPort };
