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

  async hasSuccessfulExecution(automationRuleId, domainEventId) {
    const existing = await prisma.automationExecution.findFirst({
      where: { automationRuleId, domainEventId, status: "success" },
      select: { id: true },
    });
    return existing != null;
  }
}

module.exports = { PrismaAutomationExecutionRepository };
