const prisma = require("../../../../lib/prisma");
const { MessageRepositoryPort } = require("../../application/ports/message-repository.port");

class PrismaMessageRepository extends MessageRepositoryPort {
  async create(data) {
    return prisma.message.create({ data });
  }

  async findLatestIncomingAt(userId, tenantId) {
    const message = await prisma.message.findFirst({
      where: { role: "user", conversation: { userId, tenantId } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return message?.createdAt ?? null;
  }

  async listByConversation(conversationId) {
    return prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  }

  // Historial "por cliente" (caso de uso 7) — vía Conversation.userId, mismo
  // camino ya usado por dashboard-conversation.service.js.
  async listByUser(userId) {
    return prisma.message.findMany({
      where: { conversation: { userId } },
      orderBy: { createdAt: "desc" },
    });
  }
}

module.exports = { PrismaMessageRepository };
