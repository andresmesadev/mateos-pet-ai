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
    lastMessage: lastMessage?.content ?? null,
    lastMessageAt: lastMessage?.createdAt ?? conversation.updatedAt,
    step: conversation.step ?? sessionData.step ?? null,
    requires_human_attention: sessionData.requires_human_attention === true,
    updatedAt: conversation.updatedAt,
  };
};

const listConversations = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: {
        user: {
          select: { phone: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.conversation.count(),
  ]);

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

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
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
