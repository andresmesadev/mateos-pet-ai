/**
 * Sesiones del wizard de reservas.
 * L1: caché en memoria por teléfono. L2: Conversation.sessionData + step/intent en PostgreSQL.
 * Interfaz sync (getSession / updateSession / clearSession) sin cambios para los consumidores.
 */

const prisma = require("../lib/prisma");

/** @type {Record<string, object>} */
const sessions = {};

/** @type {Record<string, { conversationId: string, userId: string }>} */
const phoneContext = {};

const SESSION_DATA_FIELDS = [
  "pet_name",
  "pet_type",
  "requested_service",
  "date",
  "time",
  "scheduling_date_key",
  "scheduling_hour",
  "requires_human_attention",
];

const mergeSession = (current, data) => {
  const result = { ...current };

  if (!data || typeof data !== "object") {
    return result;
  }

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }

  return result;
};

const pickSessionDataFields = (session) => {
  const payload = {};

  for (const key of SESSION_DATA_FIELDS) {
    if (session[key] !== undefined) {
      payload[key] = session[key];
    }
  }

  return payload;
};

const conversationToSession = (conversation) => {
  if (!conversation) {
    return {};
  }

  const raw =
    conversation.sessionData &&
    typeof conversation.sessionData === "object" &&
    !Array.isArray(conversation.sessionData)
      ? conversation.sessionData
      : {};

  const session = { ...raw };

  if (conversation.step != null && conversation.step !== "") {
    session.step = conversation.step;
  }

  if (conversation.intent != null && conversation.intent !== "") {
    session.intent = conversation.intent;
  }

  return session;
};

/**
 * Registra contexto DB y restaura sesión si no hay caché en RAM (p. ej. tras reinicio).
 * Llamado desde conversation-persistence al cargar/crear conversación.
 */
const hydrateSessionFromConversation = (phone, conversation) => {
  const normalizedPhone = String(phone || "").trim();

  if (!normalizedPhone || !conversation?.id) {
    return getSession(normalizedPhone);
  }

  phoneContext[normalizedPhone] = {
    conversationId: conversation.id,
    userId: conversation.userId,
  };

  const cached = sessions[normalizedPhone];
  const hasCachedSession =
    cached && typeof cached === "object" && Object.keys(cached).length > 0;

  if (hasCachedSession) {
    return cached;
  }

  sessions[normalizedPhone] = conversationToSession(conversation);
  console.log(
    "[Memory] Session hydrated from DB:",
    normalizedPhone,
    conversation.id
  );

  return sessions[normalizedPhone];
};

const getSession = (phone) => {
  const normalizedPhone = String(phone || "").trim();
  return sessions[normalizedPhone] || {};
};

const persistSessionToDb = async (phone, session) => {
  const ctx = phoneContext[phone];

  if (!ctx?.conversationId) {
    console.warn("[Memory] No conversation context for persist:", phone);
    return;
  }

  const data = {
    sessionData: pickSessionDataFields(session),
  };

  if (session.step !== undefined) {
    data.step = session.step;
  }

  if (session.intent !== undefined) {
    data.intent = session.intent;
  }

  try {
    await prisma.conversation.update({
      where: { id: ctx.conversationId },
      data,
    });
    console.log("[Memory] Session persisted to DB:", phone);
  } catch (error) {
    console.error("[Memory] persistSessionToDb error:", error.message);
  }
};

const updateSession = (phone, data) => {
  const normalizedPhone = String(phone || "").trim();
  const current = sessions[normalizedPhone] || {};
  sessions[normalizedPhone] = mergeSession(current, data);

  persistSessionToDb(normalizedPhone, sessions[normalizedPhone]).catch(
    (error) => {
      console.error("[Memory] Background persist failed:", error.message);
    }
  );

  return sessions[normalizedPhone];
};

const clearSession = (phone) => {
  const normalizedPhone = String(phone || "").trim();
  delete sessions[normalizedPhone];

  const ctx = phoneContext[normalizedPhone];
  delete phoneContext[normalizedPhone];

  if (ctx?.conversationId) {
    prisma.conversation
      .update({
        where: { id: ctx.conversationId },
        data: {
          sessionData: {},
          step: null,
          intent: null,
        },
      })
      .then(() => {
        console.log("[Memory] Session cleared in DB:", normalizedPhone);
      })
      .catch((error) => {
        console.error("[Memory] clearSession DB error:", error.message);
      });
  }
};

module.exports = {
  getSession,
  updateSession,
  clearSession,
  hydrateSessionFromConversation,
  SESSION_DATA_FIELDS,
};
