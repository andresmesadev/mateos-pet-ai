const prisma = require("../../../../lib/prisma");
const { DomainEventRepositoryPort } = require("../../application/ports/domain-event-repository.port");

class PrismaDomainEventRepository extends DomainEventRepositoryPort {
  async create(data, ctx) {
    const client = ctx?.tx ?? prisma;
    return client.domainEvent.create({ data });
  }

  async findById(id) {
    return prisma.domainEvent.findUnique({ where: { id } });
  }

  async listByFilters({ tenantId, eventTypeName, dateStart, dateEnd }) {
    const eventTypeFilter = eventTypeName ? { eventType: { name: eventTypeName } } : {};
    const dateFilter = {};
    if (dateStart) dateFilter.gte = dateStart;
    if (dateEnd) dateFilter.lte = dateEnd;

    return prisma.domainEvent.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}), // tenantId es obligatorio al escribir (Invariante 4); al consultar, ausente = superadmin viendo todos los tenants
        ...eventTypeFilter,
        ...(Object.keys(dateFilter).length ? { occurredAt: dateFilter } : {}),
      },
      include: { eventType: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
    });
  }
}

module.exports = { PrismaDomainEventRepository };
