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

const mapEscalation = (conversation) => {
  const sessionData = parseSessionData(conversation.sessionData);
  const lastMessage = conversation.messages?.[0] ?? null;

  return {
    id: conversation.id,
    userId: conversation.userId,
    phone: conversation.user?.phone ?? null,
    petName: sessionData.pet_name ?? null,
    lastMessage: lastMessage?.content ?? null,
    lastMessageAt: lastMessage?.createdAt ?? conversation.updatedAt,
    updatedAt: conversation.updatedAt,
    requiresHumanAttention: sessionData.requires_human_attention === true,
  };
};

/**
 * Conversaciones con requires_human_attention en sessionData.
 */
const getPendingEscalations = async (tenantId) => {
  const tenantFilter = tenantId ? { tenantId } : {};
  const conversations = await prisma.conversation.findMany({
    where: {
      ...tenantFilter,
      sessionData: {
        path: ["requires_human_attention"],
        equals: true,
      },
    },
    include: {
      user: {
        select: { phone: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  console.log("[Escalation] Pending escalations:", conversations.length);

  return conversations.map(mapEscalation);
};

/**
 * Marca escalación como atendida (requires_human_attention = false).
 */
const resolveEscalation = async (conversationId) => {
  const id = String(conversationId || "").trim();

  if (!id) {
    throw new Error("conversationId is required");
  }

  const existing = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  const sessionData = {
    ...parseSessionData(existing.sessionData),
    requires_human_attention: false,
  };

  const updated = await prisma.conversation.update({
    where: { id },
    data: { sessionData },
    include: {
      user: {
        select: { phone: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  console.log("[Escalation] Resolved:", id);

  return mapEscalation(updated);
};

module.exports = {
  getPendingEscalations,
  resolveEscalation,
};
