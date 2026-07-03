/**
 * ListDomainEventsUseCase — Consulta. Caso de uso 7 (Etapa 2).
 * Consulta Eventos de Dominio por tipo, rango de fechas y tenant.
 */
function createListDomainEventsUseCase({ domainEventRepository }) {
  return async function execute({ tenantId, eventTypeName = null, dateStart = null, dateEnd = null }) {
    const domainEvents = await domainEventRepository.listByFilters({
      tenantId,
      eventTypeName,
      dateStart: dateStart ? new Date(dateStart) : null,
      dateEnd: dateEnd ? new Date(dateEnd) : null,
    });
    return { domainEvents };
  };
}

module.exports = { createListDomainEventsUseCase };
