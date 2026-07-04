const prisma = require("../../../../lib/prisma");
const { AgentTaskRepositoryPort } = require("../../application/ports/agent-task-repository.port");

class PrismaAgentTaskRepository extends AgentTaskRepositoryPort {
  async create(data) {
    return prisma.agentTask.create({ data });
  }

  async findById(id) {
    return prisma.agentTask.findUnique({ where: { id } });
  }

  async complete(id, result) {
    return prisma.agentTask.update({ where: { id }, data: { status: "completada", result: result ?? undefined } });
  }

  async escalate(id) {
    return prisma.agentTask.update({ where: { id }, data: { status: "escalada" } });
  }

  async listByEmployee(digitalEmployeeId) {
    return prisma.agentTask.findMany({
      where: { digitalEmployeeId },
      orderBy: { createdAt: "desc" },
    });
  }
}

module.exports = { PrismaAgentTaskRepository };
