const prisma = require("../../../../lib/prisma");
const CANONICAL_ORDER = [{ assignedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }, { id: "desc" }];

class PrismaConversationControlRepository {
  findScoped(id, tenantId) {
    return prisma.conversation.findFirst({ where: { id, tenantId }, include: { user: { select: { phone: true } } } });
  }
  findCanonical(userId, tenantId) {
    return prisma.conversation.findFirst({ where: { userId, tenantId }, orderBy: CANONICAL_ORDER });
  }
  async changeControl(current, actor) {
    const now = new Date();
    const result = await prisma.conversation.updateMany({
      where: { id: current.id, tenantId: current.tenantId, controlVersion: current.controlVersion },
      data: {
        status: actor ? "esperando_humano" : "activa",
        assignedActorId: actor?.id ?? null, assignedActorName: actor?.name ?? null,
        assignedActorRole: actor?.role ?? null, assignedAt: actor ? now : null,
        controlChangedAt: now, controlVersion: { increment: 1 },
      },
    });
    return result.count === 1 ? prisma.conversation.findUnique({ where: { id: current.id } }) : null;
  }
}
module.exports = { PrismaConversationControlRepository, CANONICAL_ORDER };
