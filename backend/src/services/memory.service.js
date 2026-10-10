/**
 * Sesiones del wizard de reservas.
 * L1: caché en memoria por teléfono. L2: Conversation.sessionData + step/intent en PostgreSQL.
 * Interfaz sync (getSession / updateSession / clearSession) sin cambios para los consumidores.
 */

const prisma = require("../lib/prisma");
const { assertValidStep } = require("./session-steps.service");

/** @type {Record<string, object>} */
const sessions = {};

/** @type {Record<string, { conversationId: string, userId: string }>} */
const phoneContext = {};
const persistenceQueues = new Map();
const touched = new Map();
const scopedPhone = (phone, tenantId) => tenantId ? `${tenantId}:${String(phone || "").trim()}` : String(phone || "").trim();

const SESSION_DATA_FIELDS = [
  "client_name",
  "pet_name",
  "pet_type",
  "requested_service",
  "date",
  "time",
  "scheduling_date_key",
  "scheduling_hour",
  "requires_human_attention",
  // Grooming flow
  "grooming_service",
  "domicilio",
  "domicilio_address",
  "management_action", "management_appointment_id", "management_candidates", "management_resume_step", "reschedule_appointment_id",
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
  const normalizedPhone = scopedPhone(phone, conversation?.tenantId);

  if (!normalizedPhone || !conversation?.id) {
    return getSession(normalizedPhone);
  }

  const sameConversation = phoneContext[normalizedPhone]?.conversationId === conversation.id;
  phoneContext[normalizedPhone] = {
    conversationId: conversation.id,
    userId: conversation.userId,
  };

  const cached = sessions[normalizedPhone];
  const hasCachedSession =
    cached && typeof cached === "object" && Object.keys(cached).length > 0;

  if (hasCachedSession && sameConversation) {
    if (conversation.status === "activa") {
      if (cached.step === "human_takeover") cached.step = null;
      cached.requires_human_attention = false;
    }
    return cached;
  }

  sessions[normalizedPhone] = conversationToSession(conversation);
  if (conversation.status === "activa") {
    if (sessions[normalizedPhone].step === "human_takeover") sessions[normalizedPhone].step = null;
    sessions[normalizedPhone].requires_human_attention = false;
  }
  touched.set(normalizedPhone, Date.now());
  console.log(
    "[Memory] Session hydrated from DB:",
    normalizedPhone,
    conversation.id
  );

  return sessions[normalizedPhone];
};

const getSession = (phone, tenantId) => {
  const normalizedPhone = scopedPhone(phone, tenantId);
  for (const [key, at] of [...touched].sort((a, b) => a[1] - b[1])) {
    if (key === normalizedPhone) continue;
    if (persistenceQueues.has(phoneContext[key]?.conversationId)) continue;
    if (Date.now() - at > 30 * 60 * 1000 || touched.size > 1000) {
      delete sessions[key]; delete phoneContext[key]; touched.delete(key);
    }
  }
  if (sessions[normalizedPhone]) touched.set(normalizedPhone, Date.now());
  return sessions[normalizedPhone] || {};
};

const persistSessionToDb = async (ctx, session) => {

  if (!ctx?.conversationId) {
    return;
  }

  const data = {
    sessionData: pickSessionDataFields(session),
    abandonReminderSent: false,
    step: session.step ?? null,
    intent: session.intent ?? null,
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
  } catch (error) {
    console.error("[Memory] persistSessionToDb error:", error.message);
    throw error;
  }
};

const queueSnapshot = (ctx, session) => {
  if (!ctx?.conversationId) return;
  const snapshot = JSON.parse(JSON.stringify(session));
  const pending = (persistenceQueues.get(ctx.conversationId) || Promise.resolve()).catch(() => {}).then(() => persistSessionToDb(ctx, snapshot));
  persistenceQueues.set(ctx.conversationId, pending);
  pending.catch(error => console.error("[Memory] Snapshot failed:", error.message));
};
const flushConversationSession = async conversationId => {
  const pending = persistenceQueues.get(conversationId);
  if (!pending) return false;
  try { await pending; }
  catch (error) {
    // Do not let an uncommitted RAM snapshot become the next turn's authority.
    for (const [key, context] of Object.entries(phoneContext)) if (context.conversationId === conversationId) {
      delete sessions[key]; delete phoneContext[key]; touched.delete(key);
    }
    if (persistenceQueues.get(conversationId) === pending) persistenceQueues.delete(conversationId);
    throw error;
  }
  if (persistenceQueues.get(conversationId) === pending) persistenceQueues.delete(conversationId);
  return true;
};
const updateSession = (phone, data, tenantId) => {
  const normalizedPhone = scopedPhone(phone, tenantId);

  // Entregable 8.3 (D-E1): único choke point de escritura de session.step —
  // registra (no bloquea) si algún llamador intenta escribir un valor fuera
  // del vocabulario cerrado de STEPS. Ver session-steps.service.js.
  if (data && typeof data === "object" && "step" in data) {
    assertValidStep(data.step, { phone: normalizedPhone });
  }

  const current = sessions[normalizedPhone] || {};
  sessions[normalizedPhone] = mergeSession(current, data);

  touched.set(normalizedPhone, Date.now());
  queueSnapshot(phoneContext[normalizedPhone], sessions[normalizedPhone]);

  return sessions[normalizedPhone];
};

const clearSession = (phone, tenantId) => {
  const normalizedPhone = scopedPhone(phone, tenantId);
  delete sessions[normalizedPhone];

  const ctx = phoneContext[normalizedPhone];
  delete phoneContext[normalizedPhone];
  touched.delete(normalizedPhone);

  if (ctx?.conversationId) {
    queueSnapshot(ctx, { step: null, intent: null });
  }
};

module.exports = {
  getSession,
  updateSession,
  clearSession,
  hydrateSessionFromConversation,
  flushConversationSession,
  SESSION_DATA_FIELDS,
};
