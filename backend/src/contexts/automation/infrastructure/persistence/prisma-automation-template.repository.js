const prisma = require("../../../../lib/prisma");
const { AutomationTemplateRepositoryPort } = require("../../application/ports/automation-template-repository.port");

class PrismaAutomationTemplateRepository extends AutomationTemplateRepositoryPort {
  async create(data) {
    return prisma.automationTemplate.create({ data });
  }

  async findById(id) {
    return prisma.automationTemplate.findUnique({ where: { id } });
  }

  async list() {
    return prisma.automationTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  }
}

module.exports = { PrismaAutomationTemplateRepository };
