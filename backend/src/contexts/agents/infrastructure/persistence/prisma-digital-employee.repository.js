const prisma = require("../../../../lib/prisma");
const { DigitalEmployeeRepositoryPort } = require("../../application/ports/digital-employee-repository.port");

class PrismaDigitalEmployeeRepository extends DigitalEmployeeRepositoryPort {
  async create(data) {
    return prisma.digitalEmployee.create({ data });
  }

  async findById(id) {
    return prisma.digitalEmployee.findUnique({ where: { id } });
  }

  async pause(id) {
    return prisma.digitalEmployee.update({ where: { id }, data: { status: "pausado" } });
  }

  async reactivate(id) {
    return prisma.digitalEmployee.update({ where: { id }, data: { status: "activo" } });
  }

  async list(tenantId) {
    return prisma.digitalEmployee.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "desc" },
    });
  }

  async setAutonomyLimit(digitalEmployeeId, action, autoApproved) {
    return prisma.agentAutonomyLimit.upsert({
      where: { digitalEmployeeId_action: { digitalEmployeeId, action } },
      create: { digitalEmployeeId, action, autoApproved },
      update: { autoApproved },
    });
  }

  async getAutonomyLimit(digitalEmployeeId, action) {
    return prisma.agentAutonomyLimit.findUnique({
      where: { digitalEmployeeId_action: { digitalEmployeeId, action } },
    });
  }
}

module.exports = { PrismaDigitalEmployeeRepository };
