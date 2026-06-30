const prisma = require("../../../../lib/prisma");
const { StaffCapabilityRepositoryPort } = require("../../application/ports/staff-capability-repository.port");

const UNIQUE_PARTIAL_INDEX_NAME = "StaffCapability_active_target_unique";

function isUniqueActiveTargetViolation(err) {
  const message = String(err?.message || "");
  const target = err?.meta?.target;
  return (
    message.includes(UNIQUE_PARTIAL_INDEX_NAME) ||
    (Array.isArray(target) && target.includes(UNIQUE_PARTIAL_INDEX_NAME)) ||
    target === UNIQUE_PARTIAL_INDEX_NAME
  );
}

class PrismaStaffCapabilityRepository extends StaffCapabilityRepositoryPort {
  async listActiveByStaff(staffId) {
    return prisma.staffCapability.findMany({ where: { staffId, active: true } });
  }

  async listActiveByService(serviceId) {
    return prisma.staffCapability.findMany({ where: { serviceId, active: true } });
  }

  async create(data) {
    try {
      return await prisma.staffCapability.create({ data });
    } catch (err) {
      if (isUniqueActiveTargetViolation(err)) {
        const wrapped = new Error("Violación del índice único parcial de StaffCapability");
        wrapped.code = "UNIQUE_STAFF_CAPABILITY_VIOLATION";
        throw wrapped;
      }
      throw err;
    }
  }

  async revoke(staffId, serviceId) {
    return prisma.staffCapability.updateMany({
      where: { staffId, serviceId, active: true },
      data: { active: false },
    });
  }
}

module.exports = { PrismaStaffCapabilityRepository };
