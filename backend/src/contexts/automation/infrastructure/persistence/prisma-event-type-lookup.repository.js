const prisma = require("../../../../lib/prisma");
const { EventTypeLookupPort } = require("../../application/ports/event-type-lookup.port");

/**
 * Lectura directa del Catálogo de Tipos de Evento (tabla compartida, propiedad
 * de Eventos/3.0). Automatizaciones solo lee este dato de referencia — no
 * invoca ningún caso de uso ni conoce lógica interna del contexto Eventos
 * (Etapa 3, sección 3).
 */
class PrismaEventTypeLookupRepository extends EventTypeLookupPort {
  async findActiveByName(name) {
    const eventType = await prisma.eventType.findUnique({ where: { name } });
    return eventType && eventType.active ? eventType : null;
  }
}

module.exports = { PrismaEventTypeLookupRepository };
