const prisma = require("../lib/prisma");

const parseSessionData = (sessionData) => {
  if (
    sessionData &&
    typeof sessionData === "object" &&
    !Array.isArray(sessionData)
  ) {
    return sessionData;
  }

  return {};
};

const parsePagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.limit ?? "20"), 10) || 20)
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const mapConversationSummary = (conversation) => {
  const sessionData = parseSessionData(conversation.sessionData);
  const lastMessage = conversation.messages?.[0] ?? null;

  return {
    id: conversation.id,
    phone: conversation.user?.phone ?? null,
    name: conversation.user?.name ?? null,
    lastMessage: lastMessage?.content ?? null,
    lastMessageAt: lastMessage?.createdAt ?? conversation.updatedAt,
    step: conversation.step ?? sessionData.step ?? null,
    requires_human_attention: sessionData.requires_human_attention === true,
    updatedAt: conversation.updatedAt,
  };
};

/**
 * Un mismo cliente (userId) puede tener varias filas en Conversation —
 * findOrCreateConversation (conversation-persistence.service.js) crea una
 * nueva cada vez que el flujo de reserva anterior llega a "completed". Son
 * ciclos internos de sesión, no chats distintos: el listado debe agrupar por
 * cliente (una fila = un hilo de WhatsApp), no por Conversation.
 */
const listConversations = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const tenantId = query.tenantId ?? null;
  const where = tenantId ? { tenantId } : {};

  const grouped = await prisma.conversation.groupBy({
    by: ["userId"],
    where,
    _max: { updatedAt: true },
  });

  const total = grouped.length;
  const pageUserIds = grouped
    .sort((a, b) => new Date(b._max.updatedAt) - new Date(a._max.updatedAt))
    .slice(skip, skip + limit)
    .map((g) => g.userId);

  const representatives = await Promise.all(
    pageUserIds.map((userId) =>
      prisma.conversation.findFirst({
        where: { ...where, userId },
        orderBy: { updatedAt: "desc" },
        include: {
          user: { select: { phone: true, name: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      })
    )
  );

  // Preserva el orden por actividad más reciente calculado arriba.
  const byUserId = new Map(representatives.filter(Boolean).map((c) => [c.userId, c]));
  const conversations = pageUserIds.map((id) => byUserId.get(id)).filter(Boolean);

  return {
    data: conversations.map(mapConversationSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

/**
 * El id recibido es el de la Conversation más reciente del cliente (la que
 * el listado usa como representante del hilo). El historial mostrado agrega
 * los mensajes de TODAS las Conversation del mismo userId — mismo criterio
 * de agrupación que listConversations — para que se vea como un único chat.
 */
const getConversationMessages = async (conversationId) => {
  const id = String(conversationId || "").trim();

  if (!id) {
    return null;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      user: {
        select: { phone: true, name: true },
      },
    },
  });

  if (!conversation) {
    return null;
  }

  const threadConversations = await prisma.conversation.findMany({
    where: { userId: conversation.userId, tenantId: conversation.tenantId },
    select: { id: true },
  });
  const threadConversationIds = threadConversations.map((c) => c.id);

  const messages = await prisma.message.findMany({
    where: { conversationId: { in: threadConversationIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  const sessionData = parseSessionData(conversation.sessionData);

  return {
    conversation: {
      id: conversation.id,
      phone: conversation.user?.phone ?? null,
      name: conversation.user?.name ?? null,
      step: conversation.step ?? sessionData.step ?? null,
      requires_human_attention: sessionData.requires_human_attention === true,
      updatedAt: conversation.updatedAt,
    },
    messages,
  };
};

module.exports = {
  listConversations,
  getConversationMessages,
};
