const prisma = require("../../../../lib/prisma");
const { ServiceCategoryReaderPort } = require("../../application/ports/service-category-reader.port");

class PrismaServiceCategoryReader extends ServiceCategoryReaderPort {
  async getCategoryForService(serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { category: { select: { id: true, name: true, appliesCommissionSplit: true } } },
    });
    return service?.category ?? null;
  }
}

module.exports = { PrismaServiceCategoryReader };
