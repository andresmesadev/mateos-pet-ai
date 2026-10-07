const prisma = require("../../../../lib/prisma");
const { ServiceRepositoryPort } = require("../../application/ports/service-repository.port");
const { ServiceNotFoundError } = require("../../domain/errors");
const { ServiceDeletionBlockedError } = require("../../domain/errors/service-deletion-blocked.error");

class PrismaServiceRepository extends ServiceRepositoryPort {
  async deleteRetiredIfUnused({ tenantId, serviceId, confirmName }) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${serviceId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      if (!rows.length) throw new ServiceNotFoundError(serviceId);
      const service = await tx.service.findUniqueOrThrow({ where: { id: serviceId } });
      if (service.active) throw new ServiceDeletionBlockedError("Primero retira el servicio del catálogo activo.");
      if (service.name !== confirmName) throw new ServiceDeletionBlockedError("El nombre no coincide. Revisa el nombre actual del servicio.");
      const [appointment, priceRule, capability] = await Promise.all([
        tx.appointment.findFirst({ where: { serviceId }, select: { id: true } }),
        tx.priceRule.findFirst({ where: { serviceId }, select: { id: true } }),
        tx.staffCapability.findFirst({ where: { serviceId }, select: { id: true } }),
      ]);
      if (appointment || priceRule || capability) {
        throw new ServiceDeletionBlockedError("Este servicio tiene citas, tarifas acordadas o vínculos con el equipo. Se conservará en Retirados para proteger su historial.");
      }
      await tx.service.delete({ where: { id: serviceId } });
      return { serviceId };
    });
  }
  async findById(serviceId) {
    return prisma.service.findUnique({ where: { id: serviceId } });
  }

  async findActiveByNameAndCategory(tenantId, categoryId, name) {
    return prisma.service.findFirst({
      where: { tenantId, categoryId, name, active: true },
    });
  }

  async create(data) {
    return prisma.service.create({ data });
  }

  async update(serviceId, data) {
    return prisma.service.update({ where: { id: serviceId }, data });
  }

  async listAvailable({ tenantId, categoryId, includeInactive }) {
    return prisma.service.findMany({
      where: {
        tenantId,
        ...(categoryId ? { categoryId } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { name: "asc" },
    });
  }
}

module.exports = { PrismaServiceRepository };
