const prisma = require("../../../../lib/prisma");
const { AutomationRuleRepositoryPort } = require("../../application/ports/automation-rule-repository.port");

class PrismaAutomationRuleRepository extends AutomationRuleRepositoryPort {
  async create(data) {
    return prisma.automationRule.create({ data });
  }

  async findById(id) {
    return prisma.automationRule.findUnique({ where: { id } });
  }

  async activate(id) {
    return prisma.automationRule.update({ where: { id }, data: { active: true } });
  }

  async deactivate(id) {
    return prisma.automationRule.update({ where: { id }, data: { active: false } });
  }

  async list(tenantId) {
    return prisma.automationRule.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "desc" },
    });
  }

  async listActiveByTrigger(tenantId, triggerEventTypeId, ctx) {
    const client = ctx?.tx ?? prisma;
    return client.automationRule.findMany({
      where: {
        triggerEventTypeId,
        active: true,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });
  }
}

module.exports = { PrismaAutomationRuleRepository };
