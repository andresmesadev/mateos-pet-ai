/**
 * GetEventCatalogUseCase — Consulta. Caso de uso 6 (Etapa 2).
 * Lista los Tipos de Evento activos — consumido por el operador humano y,
 * más adelante, por Automatizaciones para ofrecer disparadores configurables.
 */
function createGetEventCatalogUseCase({ eventTypeRepository }) {
  return async function execute() {
    const eventTypes = await eventTypeRepository.listActive();
    return { eventTypes };
  };
}

module.exports = { createGetEventCatalogUseCase };
