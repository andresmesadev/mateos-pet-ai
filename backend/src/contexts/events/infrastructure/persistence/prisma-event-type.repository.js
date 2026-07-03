const prisma = require("../../../../lib/prisma");
const { EventTypeRepositoryPort } = require("../../application/ports/event-type-repository.port");

class PrismaEventTypeRepository extends EventTypeRepositoryPort {
  async create(data) {
    return prisma.eventType.create({ data });
  }

  async findByName(name) {
    return prisma.eventType.findUnique({ where: { name } });
  }

  async deactivate(id) {
    return prisma.eventType.update({ where: { id }, data: { active: false } });
  }

  async listActive() {
    return prisma.eventType.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  }
}

module.exports = { PrismaEventTypeRepository };
