const prisma = require("../../../../lib/prisma");
const { EscalationRepositoryPort } = require("../../application/ports/escalation-repository.port");

class PrismaEscalationRepository extends EscalationRepositoryPort {
  async create(data) {
    return prisma.escalation.create({ data });
  }

  async findById(id) {
    return prisma.escalation.findUnique({
      where: { id },
      include: { agentTask: { include: { digitalEmployee: { select: { tenantId: true } } } } },
    });
  }

  async resolve(id, assignedStaffId) {
    return prisma.escalation.update({
      where: { id },
      data: {
        status: "atendida",
        resolvedAt: new Date(),
        ...(assignedStaffId ? { assignedStaffId } : {}),
      },
    });
  }

  async listPending(tenantId) {
    return prisma.escalation.findMany({
      where: {
        status: "pendiente",
        ...(tenantId ? { agentTask: { digitalEmployee: { tenantId } } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
  }
}

module.exports = { PrismaEscalationRepository };
