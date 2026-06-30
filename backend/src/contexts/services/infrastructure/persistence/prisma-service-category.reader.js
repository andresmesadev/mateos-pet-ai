const prisma = require("../../../../lib/prisma");
const { ServiceCategoryReaderPort } = require("../../application/ports/service-category-reader.port");

class PrismaServiceCategoryReader extends ServiceCategoryReaderPort {
  async findById(categoryId) {
    return prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  }
}

module.exports = { PrismaServiceCategoryReader };
