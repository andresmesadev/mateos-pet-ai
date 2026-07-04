const prisma = require("../../../../lib/prisma");
const { ConversationRepositoryPort } = require("../../application/ports/conversation-repository.port");

const ACTIVE_STEP_EXCLUDED = "completed";

class PrismaConversationRepository extends ConversationRepositoryPort {
  // Mismo criterio de "conversación activa" ya usado por el flujo de
  // recepción (conversation-persistence.service.js), reimplementado aquí
  // como adaptador propio de Comunicación — la recepción no se toca
  // (Decisión Diferida 3).
  async findOrCreateActiveForUser(userId, channelId) {
    const existing = await prisma.conversation.findFirst({
      where: { userId, OR: [{ step: null }, { step: { not: ACTIVE_STEP_EXCLUDED } }] },
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      if (!existing.channelId && channelId) {
        return prisma.conversation.update({ where: { id: existing.id }, data: { channelId } });
      }
      return existing;
    }

    return prisma.conversation.create({ data: { userId, channelId: channelId ?? null } });
  }

  async findById(id) {
    return prisma.conversation.findUnique({ where: { id } });
  }

  async escalate(conversationId) {
    return prisma.conversation.update({ where: { id: conversationId }, data: { status: "esperando_humano" } });
  }

  async resolveEscalation(conversationId) {
    return prisma.conversation.update({ where: { id: conversationId }, data: { status: "activa" } });
  }

  async listEscalatedPending(tenantId) {
    return prisma.conversation.findMany({
      where: { ...(tenantId ? { tenantId } : {}), status: "esperando_humano" },
      include: {
        user: { select: { phone: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
  }
}

module.exports = { PrismaConversationRepository };
