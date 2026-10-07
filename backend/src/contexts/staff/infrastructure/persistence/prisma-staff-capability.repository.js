const prisma = require("../../../../lib/prisma");
const { StaffCapabilityRepositoryPort } = require("../../application/ports/staff-capability-repository.port");
const { ReferencedServiceNotFoundError } = require("../../domain/errors");

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
  constructor(db = prisma) { super(); this.db = db; }
  async listActiveByStaff(staffId) {
    return this.db.staffCapability.findMany({ where: { staffId, active: true } });
  }

  async listActiveByService(serviceId) {
    return this.db.staffCapability.findMany({ where: { serviceId, active: true } });
  }

  async create(data) {
    try {
      const run = async (tx) => {
        // Sin FK: revalidar y bloquear la referencia en la transacción de escritura.
        const rows = await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${data.serviceId} FOR KEY SHARE`;
        if (!rows.length) throw new ReferencedServiceNotFoundError(data.serviceId);
        return tx.staffCapability.create({ data });
      };
      return this.db.$transaction ? await this.db.$transaction(run) : await run(this.db);
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
    return this.db.staffCapability.updateMany({
      where: { staffId, serviceId, active: true },
      data: { active: false },
    });
  }
}

module.exports = { PrismaStaffCapabilityRepository };
