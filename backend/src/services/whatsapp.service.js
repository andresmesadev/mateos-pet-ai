const { analyzeMessage } = require("./openai.service");
const logger = require("../lib/logger");
const {
  generateReply,
  isConfirmationMessage,
  STEPS,
} = require("./conversation.service");
const { getSession: getCachedSession, updateSession: updateCachedSession } = require("./memory.service");
const { prepareBookingTurn, separateClientAndPet, isAcknowledgementOnly, selectCurrentPet, confirmsSelectedPet } = require("./booking-turn.service");
const { buildBookingConfirmation } = require("./booking-message.service");
const scheduling = require("./scheduling.service");
const { findOrCreateUser, updateUserNameIfMissing } = require("./user.service");
const { findPetByNameAndOwner, resolveAppointmentPetName } = require("./pet.service");
const {
  buildAppointmentDateTime,
  mapSessionServiceType,
  createAppointment,
  rescheduleAppointment,
  checkAppointmentConflict,
} = require("./appointment.service");
const { formatSlotForUser } = require("../lib/timezone");
const {
  findOrCreateConversation,
  saveMessage,
  findMessageByExternalId,
  getConversationMessages,
  syncConversationState,
} = require("./conversation-persistence.service");
const { buildConversationHistory } = require("./context-builder.service");
const { runExclusive } = require("./phone-lock.service");
const {
  searchRelevantMemories,
  buildSemanticContext,
} = require("./semantic-memory.service");
const {
  searchRelevantKnowledge,
  buildKnowledgeContext,
} = require("./business-knowledge.service");
const { processVoiceMessage } = require("./audio.service");
const { getTenantByPhone } = require("./tenant.service");
const { generateEmbedding } = require("./embedding.service");

const persistUserMessage = async (user, conversation, content, externalId) => {
  if (!user?.id || !conversation?.id || !content) return;

  try {
    await saveMessage({
      conversationId: conversation.id,
      userId: user.id,
      role: "user",
      content,
      externalId,
    });
    logger.info("[WhatsApp] Message persisted");
  } catch (error) {
    logger.error("[WhatsApp] Error persisting user message:", error.message);
    throw error;
  }
};

// Entregable 3.1 — Comunicación: la persistencia del mensaje saliente del
// bot ya no ocurre aquí. Este archivo solo devuelve `reply`, `user` y
// `conversation`; quien invoca processIncomingMessage (webhook.controller.js)
// llama a Enviar Mensaje, que envía Y persiste de forma atómica (todo o
// nada). persistAssistantMessage se retiró — ver Bloque 8/9 del Entregable 3.1.

const isEmptyValue = (value) => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "" || normalized === "n/a";
  }

  return false;
};

const isPlausibleClientName = (value) => {
  const name = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{1,59}$/.test(name);
};

const mergeSessionData = (previous, current) => {
  const result = { ...previous };

  if (!current || typeof current !== "object") {
    return result;
  }

  for (const key of Object.keys(current)) {
    if (!isEmptyValue(current[key])) {
      result[key] = current[key];
    }
  }

  return result;
};

const verifyWebhookSignature = (mode, token, challenge) => {
  const verifyToken = String(process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
  const hubToken = token == null ? "" : String(token).trim();
  const challengeStr =
    challenge == null ? "" : String(challenge);

  if (mode && hubToken === verifyToken && challengeStr.length > 0) {
    return challengeStr;
  }

  return null;
};

// Normaliza un único objeto `message` del payload de Meta (ya resuelto el
// `phoneNumberId` de su `value`) a la forma interna que consume el resto del
// motor. Compartida por parseIncomingMessage (compatibilidad, un mensaje) y
// parseIncomingMessages (Entregable 8.1 — D-E5, todos los mensajes del batch).
const normalizeIncomingMessage = (message, phoneNumberId) => {
  const from = message.from;

  if (!from) {
    return null;
  }

  // Entregable 8.1 (D-E4): wamid de Meta, transportado hasta la persistencia
  // para poder detectar un reintento de webhook antes de reprocesar.
  const wamid = message.id ?? null;

  if (message.type === "audio" && message.audio?.id) {
    return {
      from,
      text: null,
      type: "audio",
      mediaId: message.audio.id,
      phoneNumberId,
      wamid,
    };
  }

  if (message.type === "image" && message.image?.id) {
    return {
      from,
      text: null,
      type: "image",
      mediaId: message.image.id,
      mimeType: message.image.mime_type || "image/jpeg",
      phoneNumberId,
      wamid,
    };
  }

  if (message.type === "document") {
    return { from, text: null, type: "document", phoneNumberId, wamid };
  }

  let text = null;

  if (message.type === "text") {
    text = message.text?.body ?? null;
  } else if (message.type === "button") {
    text = message.button?.text ?? null;
  } else if (message.type === "interactive") {
    text =
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      null;
  }

  if (!text) {
    return null;
  }

  return { from, text, type: message.type, phoneNumberId, wamid };
};

// Preservada sin cambios de comportamiento: solo ve el primer mensaje del
// payload. resolve-tenant-id.js (Recepcionista IA) sigue dependiendo de esta
// firma exacta para resolver el tenant antes de invocar el motor — Meta
// agrupa mensajes del mismo remitente/línea en un mismo payload, así que el
// primero es representativo del tenant de todo el batch.
const parseIncomingMessage = (body) => {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (!message) {
    return null;
  }

  // phone_number_id identifica la línea WhatsApp Business (= un tenant)
  const phoneNumberId =
    value?.metadata?.phone_number_id ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    null;

  return normalizeIncomingMessage(message, phoneNumberId);
};

// Entregable 8.1 (D-E5): parseIncomingMessage solo veía entry[0].changes[0]
// .messages[0] — el resto del batch de Meta se descartaba en silencio. Esta
// función itera las tres dimensiones completas y devuelve todos los mensajes
// soportados, en el orden en que Meta los entregó.
const parseIncomingMessages = (body) => {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  const parsed = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      const phoneNumberId =
        value?.metadata?.phone_number_id ||
        process.env.WHATSAPP_PHONE_NUMBER_ID ||
        null;
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      for (const message of messages) {
        const normalized = normalizeIncomingMessage(message, phoneNumberId);
        if (normalized) {
          parsed.push(normalized);
        }
      }
    }
  }

  return parsed;
};

// Entregable 8.1 (D-E5): procesa un mensaje ya normalizado. Es exactamente el
// cuerpo que antes vivía dentro de processIncomingMessage(body) — sin ningún
// cambio de comportamiento — extraído para poder invocarse una vez por cada
// mensaje del batch en vez de una sola vez por payload.
const processSingleIncomingMessage = async (parsed) => {
  // Entregable 8.1 (D-E4): un reintento de webhook de Meta (mismo wamid, por
  // timeout de nuestro lado) se detecta ANTES de gastar Whisper/Vision/LLM y
  // de tocar sesión o BD — corta aquí, antes de cualquier efecto secundario.
  if (parsed.wamid) {
    const existing = await findMessageByExternalId(parsed.wamid);
    if (existing) {
      logger.info(`[WhatsApp] Mensaje duplicado ignorado (wamid ${parsed.wamid})`);
      return { received: true, processed: false, duplicate: true };
    }
  }

  // Mejora post-Fase 8 (2026-09-08): antes, si Whisper no lograba transcribir
  // (audio muy corto, ruido, fallo transitorio de OpenAI), la función
  // retornaba aquí mismo con `processed: false` — el cliente se quedaba sin
  // ninguna respuesta, ni siquiera un aviso de que algo falló. La rama de
  // imagen (más abajo) ya maneja su propio fallo así ("No pude analizar la
  // imagen..."); audio no tenía el mismo respaldo. En vez de cortar aquí (sin
  // user/conversation resueltos todavía, no hay a quién responderle), se
  // marca la falla y se sigue el flujo normal — la respuesta de repuesto se
  // envía más abajo, ya con user/conversation disponibles.
  let voiceTranscriptionFailed = false;
  if (parsed.type === "audio" && parsed.mediaId) {
    logger.info("[WhatsApp] Voice message detected");

    const transcript = await processVoiceMessage(parsed.mediaId);

    if (!transcript) {
      logger.info("[WhatsApp] Voice transcription failed");
      voiceTranscriptionFailed = true;
    } else {
      parsed.text = transcript;
      parsed.type = "text";
      logger.info("[WhatsApp] Voice transcription:", transcript);
    }
  }

  logger.info(`New message from: ${parsed.from}`);

  // Identificar tenant por el phone_number_id de la línea WhatsApp Business
  // (movido antes de la rama "documento" — Entregable 3.1, Bloque 8: Enviar
  // Mensaje necesita user/conversation disponibles para TODA rama con reply,
  // sin cambiar el comportamiento de recepción de ningún tipo de mensaje).
  let tenantId = null;
  let businessName = "el establecimiento";
  if (parsed.phoneNumberId) {
    try {
      const tenant = await getTenantByPhone(parsed.phoneNumberId);
      if (tenant?.active) {
        tenantId = tenant.id;
        businessName = tenant.name || businessName;
        logger.info(`[WhatsApp] Tenant identified: ${tenant.slug} (${tenant.id})`);
      }
    } catch (error) {
      logger.error("[WhatsApp] Error resolving tenant:", error.message);
    }
  }

  let user = null;
  const getSession = phone => getCachedSession(phone, tenantId);
  const updateSession = (phone, data) => updateCachedSession(phone, data, tenantId);
  try {
    user = await findOrCreateUser(parsed.from, tenantId);
    logger.info(
      `[WhatsApp] User loaded: ${user.id}`
    );
  } catch (error) {
    logger.error("[WhatsApp] Error loading user:", error.message);
    throw error;
  }

  let conversation = null;
  if (user) {
    try {
      conversation = await findOrCreateConversation(user.id);
      logger.info(
        `[WhatsApp] Conversation loaded: ${conversation.id} (user ${user.id})`
      );
      // parsed.text es null para audio no transcrito/documento/imagen —
      // persistUserMessage no-opea sin contenido (guard existente), mismo
      // comportamiento que antes de este reordenamiento.
      await persistUserMessage(user, conversation, parsed.text, parsed.wamid);
    } catch (error) {
      logger.error("[WhatsApp] Error loading conversation:", error.message);
      throw error;
    }
  }

  // Mejora post-Fase 8 (2026-09-08): una conversación escalada a humano no
  // silenciaba al bot — `session.step === HUMAN_TAKEOVER` nunca se leía para
  // bloquear nada (solo alimentaba auditoría en el caso de uso de
  // Recepcionista IA), y "Resolver Escalación" del dashboard solo cambia
  // `Conversation.status`, nunca la sesión en memoria. Resultado real: Lina
  // seguía respondiendo en paralelo a un cliente que ya estaba hablando con
  // un humano. Se corta aquí, ANTES de imagen/documento/wizard — el mensaje
  // ya quedó persistido arriba (visible para el humano en el dashboard), solo
  // se omite la respuesta automática. Se reactiva solo al resolver la
  // escalación (Conversation.status vuelve a "activa"), sin tocar
  // session.step — Conversation.status ya es la fuente de verdad real desde
  // el Entregable 3.1, per CLAUDE.md.
  if (conversation?.status === "esperando_humano") {
    logger.info(
      `[WhatsApp] Conversación ${conversation.id} escalada a humano — mensaje guardado, sin respuesta automática`
    );
    return {
      received: true,
      processed: true,
      from: parsed.from,
      user,
      conversation,
      reply: null,
      ...parsed,
    };
  }

  if (voiceTranscriptionFailed) {
    logger.info("[WhatsApp] Enviando respuesta de respaldo — transcripción de voz falló");
    return {
      received: true,
      processed: true,
      from: parsed.from,
      user,
      conversation,
      reply: "No logré entender tu nota de voz 😔 ¿Puedes intentar de nuevo o escribirme el mensaje? 🐾",
      ...parsed,
    };
  }

  if (parsed.type === "document") {
    logger.info("[WhatsApp] Document message received — not supported");
    return {
      received: true,
      processed: true,
      from: parsed.from,
      user,
      conversation,
      reply:
        "Puedo recibir texto y notas de voz; las imágenes las revisa el equipo. Para ese archivo, contacta al establecimiento. 🐾",
    };
  }

  logger.info("[WhatsApp] Incoming type:", parsed.type);

  if (parsed.type === "image" && parsed.mediaId) {
    await persistUserMessage(user, conversation, "📷 Imagen recibida; requiere revisión del equipo.", parsed.wamid);
    const session = updateSession(parsed.from, { ...getSession(parsed.from), step: STEPS.HUMAN_TAKEOVER, requires_human_attention: true });
    await syncConversationState(conversation?.id, { step: session.step, intent: session.intent });
    return { received: true, processed: true, user, conversation, ...parsed, session, escalationRequested: true,
      reply: "Recibí tu imagen 📸 Solicitaré que el equipo la revise. No realizo diagnósticos ni guardo notas clínicas automáticamente." };
  }

  let previous = getSession(parsed.from);
  logger.info("[Conversation] Current step:", previous.step ?? "(none)");

  const turnNow = new Date();
  const explicitTerms = typeof scheduling.extractExplicitSchedulingTerms === "function"
    ? scheduling.extractExplicitSchedulingTerms(parsed.text, turnNow)
    : { dateText: null, timeText: null };
  const turn = prepareBookingTurn(previous, parsed.text, turnNow, {
    ...explicitTerms,
    dateKey: explicitTerms.dateText ? scheduling.parseDateToKey(explicitTerms.dateText, turnNow) : null,
    hour: explicitTerms.timeText ? scheduling.parseTimeToHour(explicitTerms.timeText) : null,
  });
  previous = turn.previous;

  if (scheduling.detectHumanEscalation(parsed.text)) {
    const reply =
      "Entiendo 😊\nSolicitaré que una persona del equipo revise tu conversación. 🐾";
    const session = updateSession(parsed.from, {
      ...previous,
      requires_human_attention: true,
      step: null,
    });
    logger.info(
      "[scheduling] Sesión marcada requires_human_attention:",
      parsed.from
    );
    logger.info("[Conversation] New step:", session.step ?? "(none)");

    await syncConversationState(conversation?.id, {
      intent: session.intent,
      step: session.step,
    });

    return {
      received: true,
      processed: true,
      from: parsed.from,
      user,
      conversation,
      reply,
      ...parsed,
      session,
      escalationRequested: true,
    };
  }

  if (
    previous.step === "awaiting_confirmation" &&
    isConfirmationMessage(parsed.text) && confirmsSelectedPet(parsed.text, previous.pet_name)
  ) {
    const dateKey = previous.scheduling_date_key;
    const hour = previous.scheduling_hour;

    if (user && dateKey != null && hour != null) {
      if (!previous.requested_service || (previous.domicilio === true && !require("./assistant-protocol.service").isPickupAddress(previous.domicilio_address))) {
        const step = previous.requested_service ? STEPS.AWAITING_DOMICILIO_ADDRESS : null;
        const session = updateSession(parsed.from, { ...previous, step });
        await syncConversationState(conversation?.id, { step, intent: session.intent });
        return { received: true, processed: true, user, conversation, ...parsed, session, appointment: null,
          reply: previous.requested_service ? "Antes de confirmar, necesito la dirección exacta de recogida. 📍" : "Antes de confirmar, dime si la cita es para veterinaria o peluquería. 🐾" };
      }
      if (isEmptyValue(previous.pet_name)) {
        const session = updateSession(parsed.from, { ...previous, step: STEPS.AWAITING_PET_NAME });
        await syncConversationState(conversation?.id, { intent: session.intent, step: session.step });
        return { received: true, processed: true, user, conversation, ...parsed, appointment: null,
          session, reply: "Antes de confirmar, dime el nombre de la mascota para esta cita 🐾" };
      }
      let persistedAppointment = null;
      try {
        // Para grooming usar el sub-servicio específico si está disponible
        const serviceType = previous.grooming_service
          ? previous.grooming_service
          : mapSessionServiceType(previous.requested_service);
        const appointmentDate = buildAppointmentDateTime(dateKey, hour);
        if (appointmentDate.getTime() <= Date.now()) throw new Error("Appointment slot is in the past");

        const hasConflict = !previous.reschedule_appointment_id && await checkAppointmentConflict({
          date: appointmentDate,
          serviceType,
          dateKey,
          hour,
          tenantId,
        });

        if (hasConflict) {
          const dayLabel = scheduling.formatRelativeDayLabel(
            dateKey,
            new Date()
          );
          const timeLabel = scheduling.formatHourAmPm(hour);
          const reply =
            `Lo siento 😔 El horario ${dayLabel} a las ${timeLabel} ya está ocupado.\n¿Te gustaría elegir otro día u hora? 📅`;

          logger.info(
            "[WhatsApp] Appointment blocked — slot occupied:",
            dateKey,
            hour,
            serviceType
          );

          const session = updateSession(parsed.from, {
            ...previous,
            step: STEPS.AWAITING_DATE_TIME,
            scheduling_date_key: undefined,
            scheduling_hour: undefined,
          });

          logger.info("[Conversation] New step:", session.step);

          await syncConversationState(conversation?.id, {
            intent: session.intent,
            step: session.step,
          });

          return {
            received: true,
            processed: true,
            from: parsed.from,
            user,
            conversation,
            appointment: null,
            reply,
            ...parsed,
            session,
          };
        }

        const petName = await resolveAppointmentPetName(previous.pet_name, user.id);
        const appointment = previous.reschedule_appointment_id ? await rescheduleAppointment({
          userId: user.id, tenantId, appointmentId: previous.reschedule_appointment_id, date: appointmentDate,
        }) : await createAppointment({
          userId: user.id,
          tenantId: user.tenantId || null,
          petName,
          petType: previous.pet_type || "other",
          serviceType,
          date: appointmentDate,
          status: "confirmed",
          address: previous.domicilio === true ? previous.domicilio_address || null : null,
        });
        persistedAppointment = appointment;

        logger.info(
          `[WhatsApp] Appointment persisted: ${appointment.id} (${dateKey} ${hour}h ${formatSlotForUser(dateKey, hour)}, ${serviceType})`
        );

        const step = STEPS.COMPLETED;
        const reply = buildBookingConfirmation({ petName: appointment.petName || petName, serviceType: appointment.serviceType || serviceType, dateKey, hour,
          pickup: previous.reschedule_appointment_id ? Boolean(appointment.address) : previous.domicilio === true,
          address: appointment.address || previous.domicilio_address })
          .replace("Tu cita quedó agendada.", previous.reschedule_appointment_id ? "Tu cita quedó reprogramada." : "Tu cita quedó agendada.");
        const session = updateSession(parsed.from, {
          ...previous,
          step,
          reschedule_appointment_id: null,
        });

        logger.info("[Conversation] New step:", session.step);

        await syncConversationState(conversation?.id, {
          intent: session.intent,
          step: session.step,
        });

        return {
          received: true,
          processed: true,
          from: parsed.from,
          user,
          conversation,
          appointment,
          reply,
          ...parsed,
          session,
        };
      } catch (error) {
        if (persistedAppointment) {
          error.operationAccepted = true;
          error.message = `Appointment ${persistedAppointment.id} persisted; session completion failed: ${error.message}`;
          throw error;
        }
        logger.error(
          "[WhatsApp] Error persisting appointment:",
          error.message
        );

        const reply =
          "Hubo un problema al confirmar tu cita 😔\n¿Podemos intentarlo de nuevo en un momento?";
        const session = updateSession(parsed.from, {
          ...previous,
          step: STEPS.AWAITING_CONFIRMATION,
        });

        await syncConversationState(conversation?.id, {
          intent: session.intent,
          step: session.step,
        });

        return {
          received: true,
          processed: true,
          from: parsed.from,
          user,
          conversation,
          appointment: null,
          reply,
          ...parsed,
          session,
        };
      }
    }

    logger.info(
      "[WhatsApp] Confirmación sin scheduling_date_key/hour; cita no persistida"
    );

    const reply = "No tengo un horario validado para confirmar todavía 🐾 No se guardó una cita. ¿Qué día y hora necesitas?";
    const session = updateSession(parsed.from, {
      ...previous,
      step: STEPS.AWAITING_DATE_TIME,
      scheduling_date_key: null,
      scheduling_hour: null,
    });

    logger.info("[Conversation] New step:", session.step);
    logger.info("Generated reply:", reply);

    await syncConversationState(conversation?.id, {
      intent: session.intent,
      step: session.step,
    });

    return {
      received: true,
      processed: true,
      from: parsed.from,
      user,
      conversation,
      appointment: null,
      reply,
      ...parsed,
      session,
    };
  }

  let semanticContext = "";
  const needsRetrieval = /\b(?:precio|costo|servicios|direccion|ubicacion|politica|requisito|alergia|historial|vacuna)\b/i.test(parsed.text || "");
  const queryEmbedding = needsRetrieval ? await generateEmbedding(parsed.text).catch(() => null) : null;
  if (user?.id && queryEmbedding) {
    try {
      const memories = await searchRelevantMemories({
        userId: user.id,
        query: parsed.text,
        limit: 5,
        queryEmbedding,
      });
      semanticContext = buildSemanticContext(memories);
      if (semanticContext) {
        logger.info("[SemanticMemory] Context injected");
      }
    } catch (error) {
      logger.error(
        "[WhatsApp] Semantic memory search failed:",
        error.message
      );
    }
  }

  // Base de conocimiento del negocio (notas del Establecimiento, ej.
  // ingestadas desde Obsidian vía scripts/ingest-knowledge.js) — mismo
  // mecanismo de inyección de contexto que la memoria por cliente, pero
  // acotado por tenantId. No cambia ninguna regla de negocio ni la lógica
  // de decisión del bot: solo enriquece lo que la IA ve antes de responder.
  if (tenantId && queryEmbedding) {
    try {
      const knowledge = await searchRelevantKnowledge({
        tenantId,
        query: parsed.text,
        limit: 5,
        queryEmbedding,
      });
      const knowledgeContext = buildKnowledgeContext(knowledge);
      if (knowledgeContext) {
        logger.info("[BusinessKnowledge] Context injected");
        semanticContext = semanticContext
          ? `${semanticContext}\n\n${knowledgeContext}`
          : knowledgeContext;
      }
    } catch (error) {
      logger.error(
        "[WhatsApp] Business knowledge search failed:",
        error.message
      );
    }
  }

  // Entregable 8.1 (D-M1): historial real de la conversación, leído de
  // `Message` (ya persistido, nunca antes enviado al LLM). El mensaje actual
  // ya fue guardado por persistUserMessage más arriba — es la última fila,
  // se excluye aquí para no duplicarlo (va aparte, como mensaje "user" final).
  let history = [];
  if (conversation?.id) {
    try {
      const pastMessages = await getConversationMessages(conversation.id);
      history = buildConversationHistory(pastMessages.slice(0, -1));
    } catch (error) {
      logger.error("[WhatsApp] Error loading conversation history:", error.message);
    }
  }

  let analysis = null;
  try {
    analysis = await analyzeMessage({
      message: parsed.text,
      semanticContext,
      history,
      session: previous,
    });
  } catch (error) {
    logger.error("[WhatsApp] Error al analizar mensaje:", error.message);
  }

  // Cuando el wizard pidió expresamente el nombre de la persona, una respuesta
  // breve y válida se interpreta de forma determinista. No dependemos de que
  // el LLM adivine que "Andrés" no es el nombre de una mascota.
  if (
    previous.step === STEPS.AWAITING_CLIENT_NAME &&
    isEmptyValue(analysis?.client_name) &&
    !isAcknowledgementOnly(parsed.text) &&
    isPlausibleClientName(parsed.text)
  ) {
    analysis = { ...(analysis || {}), client_name: parsed.text.trim() };
  }

  if (turn.freshRequest && !/\b(veterin\w*|consulta\w*|medic\w*|peluq\w*|groom\w*|bano\w*|corte\w*)\b/i.test(parsed.text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
    analysis = { ...(analysis || {}), requested_service: null };
  }
  ({ previous, analysis } = separateClientAndPet(previous, analysis, parsed.text));
  if (analysis?.intent === "schedule_appointment" || analysis?.requested_service || previous.requested_service || turn.freshRequest) {
    analysis = selectCurrentPet(previous, analysis, parsed.text);
  }
  const normalizedName = value => String(value || "").trim().toLocaleLowerCase("es");
  if (previous.reschedule_appointment_id && ((analysis?.pet_name && normalizedName(analysis.pet_name) !== normalizedName(previous.pet_name)) ||
      (analysis?.requested_service && previous.requested_service && analysis.requested_service !== previous.requested_service))) {
    return { received: true, processed: true, user, conversation, ...parsed, session: previous, escalationRequested: false,
      reply: `La reprogramación seleccionada es para ${previous.pet_name}. Cambiar mascota o servicio requiere una reserva nueva. Tu cita original sigue reservada; dime «Quiero una nueva cita» para empezar otra. 🐾` };
  }
  if ((analysis?.pet_name && normalizedName(analysis.pet_name) !== normalizedName(previous.pet_name)) ||
      (analysis?.requested_service && previous.requested_service && analysis.requested_service !== previous.requested_service)) {
    previous = { ...previous, pet_name: analysis.pet_name || previous.pet_name, pet_type: analysis.pet_type ?? null,
      step: null, scheduling_date_key: null, scheduling_hour: null, grooming_service: null,
      domicilio: null, domicilio_address: null };
  }
  if (explicitTerms.dateText || explicitTerms.timeText) {
    analysis = {
      ...(analysis || {}),
      // El parser de dominio volverá a interpretar el texto completo. Esto da
      // prioridad al dato recién escrito frente a la sesión o una extracción
      // parcial del modelo.
      ...(explicitTerms.dateText ? { date: explicitTerms.dateText } : {}),
      ...(explicitTerms.timeText ? { time: explicitTerms.timeText } : {}),
    };
  }

  logger.info("[WhatsApp] Analysis intent:", analysis?.intent);

  const mergedAnalysis = mergeSessionData(previous, analysis);
  if (previous.requested_service && !require("./assistant-protocol.service").classifyManagementRequest(parsed.text, analysis?.intent, previous)) {
    if (["query_appointments", "greeting"].includes(mergedAnalysis.intent)) mergedAnalysis.intent = "schedule_appointment";
  }
  // Se conserva en la respuesta interna por compatibilidad; la mascota se
  // persiste durante la confirmación de la cita, no durante la extracción.
  const pet = null;

  // Captura pasiva del nombre del cliente (nunca sobrescribe uno existente)
  // — mismo criterio aditivo que la captura de mascota, sin alterar el flujo.
  if (user && !isEmptyValue(mergedAnalysis?.client_name)) {
    try {
      const captured = await updateUserNameIfMissing(user.id, mergedAnalysis.client_name);
      if (captured) user = captured;
    } catch (error) {
      logger.error("[WhatsApp] Error al capturar nombre del cliente:", error.message);
    }
  }

  let result = await generateReply(
    {
      analysis: mergedAnalysis,
      session: previous,
      semanticContext,
      userMessage: parsed.text,
      history,
    },
    {
      now: new Date(),
      userId: user?.id,
      userName: user?.name ?? null,
      businessName,
      // Entregable 6.2 (Fase 6) — transporta el tenantId ya disponible en
      // `user` hasta el motor de disponibilidad (Tenant.businessHours real).
      tenantId: user?.tenantId ?? null,
      needsClientName: Boolean(user && !user.name),
    }
  );


  const session = updateSession(parsed.from, {
    ...mergedAnalysis,
    step: result.step,
    ...(result.sessionPatch || {}),
    requires_human_attention: result.sessionPatch?.requires_human_attention === true || result.step === STEPS.HUMAN_TAKEOVER,
  });

  logger.info("[Conversation] New step:", session.step);

  await syncConversationState(conversation?.id, {
    intent: mergedAnalysis?.intent,
    step: session.step,
  });

  return {
    received: true,
    processed: true,
    from: parsed.from,
    user,
    conversation,
    pet,
    reply: result.reply,
    ...parsed,
    analysis: mergedAnalysis,
    session,
    escalationRequested: result.sessionPatch?.requires_human_attention === true || result.step === STEPS.HUMAN_TAKEOVER,
  };
};

// Entregable 8.1 (D-E5): punto de entrada real, mismo nombre/contrato externo
// que antes (webhook.controller.js → receptionist → engine adapter siguen
// invocando processIncomingMessage(body) esperando un único resultado con
// {from, reply, user, conversation}). Internamente procesa TODOS los
// mensajes del batch en orden — cada uno se persiste y actualiza sesión con
// normalidad — y el resultado del ÚLTIMO sigue siendo el que se retorna en
// las claves de siempre (compatibilidad total con quien ya lee `.reply`).
//
// Mejora post-Fase 8 (2026-09-08): las respuestas de los mensajes
// intermedios del batch ya no se pierden en silencio — antes solo se
// persistían y actualizaban sesión, pero su respuesta individual nunca se
// enviaba (limitación conocida documentada en el Gate Review de 8.1). Ahora
// van en `additionalReplies` (campo aditivo, nunca presente si el batch trae
// un solo mensaje), en el mismo orden en que Meta las agrupó; el llamador
// (jobs/inbound-message.job.js) las envía antes que la respuesta principal.
const processIncomingMessage = async (body) => {
  const messages = parseIncomingMessages(body);

  if (messages.length === 0) {
    logger.info("[WhatsApp] Payload ignorado (sin mensaje de texto soportado)");
    return { received: true, processed: false };
  }

  if (messages.length > 1) {
    logger.info(
      `[WhatsApp] Payload con ${messages.length} mensajes agrupados por Meta — procesando todos en orden`
    );
  }

  // Entregable 8.2 (D-E3): serializa por remitente — dos invocaciones
  // concurrentes de processIncomingMessage para el mismo `from` (dos
  // webhooks casi simultáneos, o el worker de la cola de 8.2 procesando dos
  // jobs del mismo teléfono a la vez) ya no leen la sesión desde el mismo
  // estado inicial en paralelo. Mensajes de remitentes distintos no se
  // bloquean entre sí.
  let result = null;
  const additionalReplies = [];
  for (const parsed of messages) {
    const current = await runExclusive(parsed.from, () => processSingleIncomingMessage(parsed));
    if (result?.reply) {
      additionalReplies.push({
        from: result.from,
        reply: result.reply,
        user: result.user,
        conversation: result.conversation,
      });
    }
    result = current;
  }

  return additionalReplies.length > 0 ? { ...result, additionalReplies } : result;
};

module.exports = {
  verifyWebhookSignature,
  parseIncomingMessage,
  parseIncomingMessages,
  processIncomingMessage,
};
