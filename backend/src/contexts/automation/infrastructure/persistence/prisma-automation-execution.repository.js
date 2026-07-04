const prisma = require("../../../../lib/prisma");
const { AutomationExecutionRepositoryPort } = require("../../application/ports/automation-execution-repository.port");

class PrismaAutomationExecutionRepository extends AutomationExecutionRepositoryPort {
  async create(data, ctx) {
    const client = ctx?.tx ?? prisma;
    return client.automationExecution.create({ data });
  }

  async listByRule(automationRuleId) {
    return prisma.automationExecution.findMany({
      where: { automationRuleId },
      orderBy: { createdAt: "desc" },
    });
  }
}

module.exports = { PrismaAutomationExecutionRepository };
