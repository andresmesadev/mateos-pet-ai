const prisma = require("../../../../lib/prisma");
const { AvailabilityRepositoryPort } = require("../../application/ports/availability-repository.port");

class PrismaAvailabilityRepository extends AvailabilityRepositoryPort {
  async findById(id) { return prisma.staffAvailability.findUnique({where:{id}}); }
  async voidCurrent(id,data) { return prisma.staffAvailability.updateMany({where:{id,voidedAt:null},data}); }
  async listByStaff(staffId) {
    return prisma.staffAvailability.findMany({ where: { staffId } });
  }

  async listBaseScheduleByStaff(staffId) {
    return prisma.staffAvailability.findMany({ where: { staffId, type: "base_schedule" } });
  }

  async create(data) {
    return prisma.staffAvailability.create({ data });
  }
}

module.exports = { PrismaAvailabilityRepository };
