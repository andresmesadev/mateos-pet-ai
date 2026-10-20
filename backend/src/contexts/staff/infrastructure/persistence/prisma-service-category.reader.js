const prisma = require("../../../../lib/prisma");
const { ServiceCategoryReaderPort } = require("../../application/ports/service-category-reader.port");

class PrismaServiceCategoryReader extends ServiceCategoryReaderPort {
  async getCategoryForService(serviceId, tenantId, ctx) {
    const service = await (ctx?.tx ?? prisma).service.findFirst({
      where: { id: serviceId, tenantId: tenantId ?? null },
      select: { appliesCommissionSplit: true, category: { select: { id: true, name: true, appliesCommissionSplit: true } } },
    });
    return service?.category ? { ...service.category, appliesCommissionSplit: service.appliesCommissionSplit ?? service.category.appliesCommissionSplit } : null;
  }
}

module.exports = { PrismaServiceCategoryReader };
