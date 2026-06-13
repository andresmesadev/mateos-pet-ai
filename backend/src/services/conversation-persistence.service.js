const prisma = require("../lib/prisma");
const { saveMessageEmbedding } = require("./embedding.service");
const { hydrateSessionFromConversation } = require("./memory.service");

const ACTIVE_STEP_EXCLUDED = "completed";

/**
 * Conversación activa = la más reciente del usuario cuyo step no es "completed".
 */
const findOrCreateConversation = async (userId) => {
  const id = String(userId || "").trim();

  if (!id) {
    throw new Error("userId is required");
  }

  try {
    const existing = await prisma.conversation.findFirst({
      where: {
        userId: id,
        OR: [{ step: null }, { step: { not: ACTIVE_STEP_EXCLUDED } }],
      },
      orderBy: { updatedAt: "desc" },
      include: { user: true },
    });

    if (existing) {
      console.log("[ConversationPersistence] Conversation loaded");
      if (existing.user?.phone) {
        hydrateSessionFromConversation(existing.user.phone, existing);
      }
      return existing;
    }

    const user = await prisma.user.findUnique({ where: { id } });

    const created = await prisma.conversation.create({
      data: { userId: id },
    });

    if (user?.phone) {
      hydrateSessionFromConversation(user.phone, created);
    }
    console.log("[ConversationPersistence] Conversation created");
    return created;
  } catch (error) {
    console.error(
      "[ConversationPersistence] findOrCreateConversation error:",
      error.message
    );
    throw error;
  }
};

const saveMessage = async ({ conversationId, userId, role, content }) => {
  const convId = String(conversationId || "").trim();
  const uid = String(userId || "").trim();
  const messageRole = String(role || "").trim();
  const body = String(content ?? "").trim();

  if (!convId || !messageRole || !body) {
    throw new Error("conversationId, role and content are required");
  }

  if (messageRole !== "user" && messageRole !== "assistant") {
    throw new Error('role must be "user" or "assistant"');
  }

  if (messageRole === "user" && !uid) {
    throw new Error("userId is required for user messages");
  }

  try {
    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        role: messageRole,
        content: body,
      },
    });
    console.log("[ConversationPersistence] Message saved");

    if (messageRole === "user" && uid) {
      console.log(
        "[ConversationPersistence] Triggering embedding generation"
      );
      saveMessageEmbedding({
        userId: uid,
        conversationId: convId,
        messageId: message.id,
        content: body,
        metadata: { role: messageRole },
      }).catch((err) =>
        console.error(
          "[ConversationPersistence] Embedding skipped:",
          err?.message || err
        )
      );
    }

    return message;
  } catch (error) {
    console.error("[ConversationPersistence] saveMessage error:", error.message);
    throw error;
  }
};

const getConversationMessages = async (conversationId) => {
  const convId = String(conversationId || "").trim();

  if (!convId) {
    throw new Error("conversationId is required");
  }

  try {
    return await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error(
      "[ConversationPersistence] getConversationMessages error:",
      error.message
    );
    throw error;
  }
};

/**
 * Sincroniza intent/step de la conversación en DB (opcional, no bloquea flujo).
 */
const syncConversationState = async (conversationId, { intent, step }) => {
  const convId = String(conversationId || "").trim();
  if (!convId) return null;

  const data = {};
  if (intent !== undefined) data.intent = intent;
  if (step !== undefined) data.step = step;

  if (Object.keys(data).length === 0) {
    return null;
  }

  try {
    return await prisma.conversation.update({
      where: { id: convId },
      data,
    });
  } catch (error) {
    console.error(
      "[ConversationPersistence] syncConversationState error:",
      error.message
    );
    return null;
  }
};

module.exports = {
  findOrCreateConversation,
  saveMessage,
  getConversationMessages,
  syncConversationState,
};
