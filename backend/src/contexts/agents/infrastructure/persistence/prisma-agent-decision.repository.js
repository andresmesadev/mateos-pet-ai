const prisma = require("../../../../lib/prisma");
const { AgentDecisionRepositoryPort } = require("../../application/ports/agent-decision-repository.port");

class PrismaAgentDecisionRepository extends AgentDecisionRepositoryPort {
  async create(data) {
    return prisma.agentDecision.create({ data });
  }

  async listByTask(agentTaskId) {
    return prisma.agentDecision.findMany({
      where: { agentTaskId },
      orderBy: { createdAt: "asc" },
    });
  }
}

module.exports = { PrismaAgentDecisionRepository };
