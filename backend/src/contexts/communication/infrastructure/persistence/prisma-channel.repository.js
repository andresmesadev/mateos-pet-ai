const prisma = require("../../../../lib/prisma");
const { ChannelRepositoryPort } = require("../../application/ports/channel-repository.port");

class PrismaChannelRepository extends ChannelRepositoryPort {
  async create(data) {
    return prisma.channel.create({ data });
  }

  async findById(id) {
    return prisma.channel.findUnique({ where: { id } });
  }

  async findByTenantAndType(tenantId, type) {
    return prisma.channel.findFirst({ where: { tenantId: tenantId ?? null, type } });
  }

  // Resuelve el canal activo por defecto: primero el propio del tenant, si
  // existe; si no, el global (tenantId null) — Decisión 2, diferida: hoy solo
  // existe el global.
  async findActiveDefault(tenantId) {
    if (tenantId) {
      const own = await prisma.channel.findFirst({ where: { tenantId, active: true } });
      if (own) return own;
    }
    return prisma.channel.findFirst({ where: { tenantId: null, active: true } });
  }

  async deactivate(id) {
    return prisma.channel.update({ where: { id }, data: { active: false } });
  }

  async listActive() {
    return prisma.channel.findMany({ where: { active: true }, orderBy: { type: "asc" } });
  }
}

module.exports = { PrismaChannelRepository };
