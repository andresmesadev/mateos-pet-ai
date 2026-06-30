const prisma = require("../../../../lib/prisma");
const { ServiceExistenceReaderPort } = require("../../application/ports/service-existence-reader.port");

class PrismaServiceExistenceReader extends ServiceExistenceReaderPort {
  async exists(serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
    return Boolean(service);
  }
}

module.exports = { PrismaServiceExistenceReader };
