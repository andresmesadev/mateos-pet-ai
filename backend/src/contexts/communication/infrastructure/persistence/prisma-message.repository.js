const prisma = require("../../../../lib/prisma");
const { MessageRepositoryPort } = require("../../application/ports/message-repository.port");

class PrismaMessageRepository extends MessageRepositoryPort {
  async create(data) {
    return prisma.message.create({ data });
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
