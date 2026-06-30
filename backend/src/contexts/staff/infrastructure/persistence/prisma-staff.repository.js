const prisma = require("../../../../lib/prisma");
const { StaffRepositoryPort } = require("../../application/ports/staff-repository.port");

class PrismaStaffRepository extends StaffRepositoryPort {
  async findById(staffId) {
    return prisma.staff.findUnique({ where: { id: staffId } });
  }

  async create(data) {
    return prisma.staff.create({ data });
  }

  async update(staffId, data) {
    return prisma.staff.update({ where: { id: staffId }, data });
  }

  async listActive({ tenantId, role, includeInactive }) {
    return prisma.staff.findMany({
      where: {
        tenantId,
        ...(role ? { role } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { name: "asc" },
    });
  }
}

module.exports = { PrismaStaffRepository };
