const prisma = require("../../../../lib/prisma");
const { ChannelRepositoryPort } = require("../../application/ports/channel-repository.port");
const { findConfiguredWhatsAppTenant } = require('../providers/whatsapp-route-guard');

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

  // A stored channel is not a separate provider connection. The inherited
  // WhatsApp line is available only to its explicitly bound active tenant.
  async findActiveDefault(tenantId) {
    if (tenantId) {
      const own = await prisma.channel.findFirst({ where: { tenantId, active: true } });
      if (own) {
        if (own.type === 'whatsapp' && !(await findConfiguredWhatsAppTenant(tenantId))) return null;
        return own;
      }
    }
    const global = await prisma.channel.findFirst({ where: { tenantId: null, active: true } });
    if (global?.type === 'whatsapp' && !(await findConfiguredWhatsAppTenant(tenantId))) return null;
    return global;
  }

  async deactivate(id) {
    return prisma.channel.update({ where: { id }, data: { active: false } });
  }

  async listActive() {
    return prisma.channel.findMany({ where: { active: true }, orderBy: { type: "asc" } });
  }
}

module.exports = { PrismaChannelRepository };
