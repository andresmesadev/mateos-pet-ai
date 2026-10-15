const prisma = require("../../../../lib/prisma");
const { AgentTaskRepositoryPort } = require("../../application/ports/agent-task-repository.port");

class PrismaAgentTaskRepository extends AgentTaskRepositoryPort {
  async create(data, ctx) {
    return (ctx?.tx ?? prisma).agentTask.create({ data });
  }

  async findById(id, ctx) {
    return (ctx?.tx ?? prisma).agentTask.findUnique({
      where: { id },
      include: { digitalEmployee: { select: { tenantId: true } } },
    });
  }

  async complete(id, result, ctx) {
    return (ctx?.tx ?? prisma).agentTask.update({ where: { id }, data: { status: "completada", result: result ?? undefined } });
  }

  async escalate(id, ctx) {
    return (ctx?.tx ?? prisma).agentTask.update({ where: { id }, data: { status: "escalada" } });
  }

  async listByEmployee(digitalEmployeeId) {
    return prisma.agentTask.findMany({
      where: { digitalEmployeeId },
      orderBy: { createdAt: "desc" },
    });
  }
}

module.exports = { PrismaAgentTaskRepository };
