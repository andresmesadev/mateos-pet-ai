const prisma = require("../lib/prisma");
const { CANONICAL_ORDER } = require("../contexts/communication/infrastructure/persistence/prisma-conversation-control.repository");

const mapControl = (row) => ({
  controlVersion: row.controlVersion ?? 0,
  assignment: row.assignedActorId ? { actorId: row.assignedActorId, name: row.assignedActorName, role: row.assignedActorRole, since: row.assignedAt } : null,
});

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
    userId: conversation.userId,
    tenantId: conversation.tenantId,
    phone: conversation.user?.phone ?? null,
    name: conversation.user?.name ?? null,
    lastMessage: lastMessage?.content ?? null,
    lastMessageAt: lastMessage?.createdAt ?? conversation.updatedAt,
    step: conversation.step ?? sessionData.step ?? null,
    status: conversation.status,
    ...mapControl(conversation),
    requires_human_attention: conversation.status === "esperando_humano",
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
  const search = String(query.search ?? "").trim().slice(0, 160);
  if (search) {
    const phone = /^[+\d\s().-]+$/.test(search) ? search.replace(/\D/g, "") : search;
    where.user = { OR: [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: phone || search } },
    ] };
  }
  // Filtrar estado después de elegir la sesión más reciente evita volver
  // a presentar una escalación antigua de un hilo que ya está resuelto.
  const representatives = await prisma.conversation.findMany({
    where,
    distinct: ["userId"],
    orderBy: CANONICAL_ORDER,
    include: {
      user: { select: { phone: true, name: true } },
      messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
    },
  });
  representatives.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const matching = query.attention === "human"
    ? representatives.filter((row) => row.status === "esperando_humano")
    : representatives;
  const total = matching.length;
  const conversations = matching.slice(skip, skip + limit);

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

  const anchor = await prisma.conversation.findUnique({
    where: { id },
  });
  if (!anchor) return null;
  const conversation = await prisma.conversation.findFirst({
    where: { userId: anchor.userId, tenantId: anchor.tenantId },
    orderBy: CANONICAL_ORDER,
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
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      role: true,
      origin: true,
      senderKind: true,
      senderActorId: true,
      senderName: true,
      senderRole: true,
      content: true,
      createdAt: true,
    },
  });

  const sessionData = parseSessionData(conversation.sessionData);

  return {
    conversation: {
      id: conversation.id,
      userId: conversation.userId,
      tenantId: conversation.tenantId,
      phone: conversation.user?.phone ?? null,
      name: conversation.user?.name ?? null,
      step: conversation.step ?? sessionData.step ?? null,
      status: conversation.status,
      ...mapControl(conversation),
      requires_human_attention: conversation.status === "esperando_humano",
      updatedAt: conversation.updatedAt,
    },
    messages,
  };
};

module.exports = {
  listConversations,
  getConversationMessages,
};
