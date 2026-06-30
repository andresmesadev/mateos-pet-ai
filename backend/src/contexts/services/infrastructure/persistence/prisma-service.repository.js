const prisma = require("../../../../lib/prisma");
const { ServiceRepositoryPort } = require("../../application/ports/service-repository.port");

class PrismaServiceRepository extends ServiceRepositoryPort {
  async findById(serviceId) {
    return prisma.service.findUnique({ where: { id: serviceId } });
  }

  async findActiveByNameAndCategory(tenantId, categoryId, name) {
    return prisma.service.findFirst({
      where: { tenantId, categoryId, name, active: true },
    });
  }

  async create(data) {
    return prisma.service.create({ data });
  }

  async update(serviceId, data) {
    return prisma.service.update({ where: { id: serviceId }, data });
  }

  async listAvailable({ tenantId, categoryId, includeInactive }) {
    return prisma.service.findMany({
      where: {
        tenantId,
        ...(categoryId ? { categoryId } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { name: "asc" },
    });
  }
}

module.exports = { PrismaServiceRepository };
