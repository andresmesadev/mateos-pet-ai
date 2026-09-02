const { analyzeMessage } = require("./openai.service");
const logger = require("../lib/logger");
const {
  generateReply,
  getConfirmationReply,
  isConfirmationMessage,
  STEPS,
} = require("./conversation.service");
const { getSession, updateSession } = require("./memory.service");
const scheduling = require("./scheduling.service");
const { findOrCreateUser, updateUserNameIfMissing } = require("./user.service");
const { findOrCreatePet, findPetByNameAndOwner, resolveAppointmentPetName } = require("./pet.service");
const {
  buildAppointmentDateTime,
  mapSessionServiceType,
  createAppointment,
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
const { processImageMessage } = require("./image.service");
const { createRecord } = require("./medical-record.service");
const { getTenantByPhone } = require("./tenant.service");

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

  if (parsed.type === "audio" && parsed.mediaId) {
    logger.info("[WhatsApp] Voice message detected");

    const transcript = await processVoiceMessage(parsed.mediaId);

    if (!transcript) {
      logger.info("[WhatsApp] Voice transcription failed");

      return {
        received: true,
        processed: false,
      };
    }

    parsed.text = transcript;
    parsed.type = "text";

    logger.info("[WhatsApp] Voice transcription:", transcript);
  }

  logger.info(`New message from: ${parsed.from}`);

  // Identificar tenant por el phone_number_id de la línea WhatsApp Business
  // (movido antes de la rama "documento" — Entregable 3.1, Bloque 8: Enviar
  // Mensaje necesita user/conversation disponibles para TODA rama con reply,
  // sin cambiar el comportamiento de recepción de ningún tipo de mensaje).
  let tenantId = null;
  if (parsed.phoneNumberId) {
    try {
      const tenant = await getTenantByPhone(parsed.phoneNumberId);
      if (tenant?.active) {
        tenantId = tenant.id;
        logger.info(`[WhatsApp] Tenant identified: ${tenant.slug} (${tenant.id})`);
      }
    } catch (error) {
      logger.error("[WhatsApp] Error resolving tenant:", error.message);
    }
  }

  let user = null;
  try {
    user = await findOrCreateUser(parsed.from, tenantId);
    logger.info(
      `[WhatsApp] User loaded: ${user.id} (${user.phone})`
    );
  } catch (error) {
    logger.error("[WhatsApp] Error loading user:", error.message);
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
    }
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
        "Solo proceso imágenes 📸\nSi quieres compartir información médica, envíame una foto o escríbeme un mensaje.",
    };
  }

  logger.info(`Message: ${parsed.text}`);

  if (parsed.type === "image" && parsed.mediaId) {
    logger.info("[WhatsApp] Image message detected");

    const imageSession = getSession(parsed.from);
    const petName = imageSession?.pet_name;

    if (!petName) {
      const reply =
        "Recibí tu imagen 📸 ¿De qué mascota es? Dime su nombre para guardarla en el historial médico.";
      return {
        received: true,
        processed: true,
        from: parsed.from,
        user,
        conversation,
        reply,
        ...parsed,
        session: imageSession,
      };
    }

    const imageAnalysis = await processImageMessage(parsed.mediaId);

    if (!imageAnalysis) {
      const reply =
        "No pude analizar la imagen 😔 ¿Puedes intentarlo de nuevo?";
      return {
        received: true,
        processed: true,
        from: parsed.from,
        user,
        conversation,
        reply,
        ...parsed,
        session: imageSession,
      };
    }

    let savedRecord = null;
    if (user) {
      try {
        const pet = await findPetByNameAndOwner(petName, user.id);
        if (pet) {
          savedRecord = await createRecord(
            pet.id,
            "note",
            "Análisis de imagen",
            imageAnalysis,
            new Date()
          );
          logger.info(
            "[WhatsApp] Image analysis saved as MedicalRecord:",
            savedRecord.id
          );
        }
      } catch (error) {
        logger.error(
          "[WhatsApp] Error saving image analysis as MedicalRecord:",
          error.message
        );
      }
    }

    const reply = savedRecord
      ? `📸 Esto es lo que observé en la imagen:\n\n${imageAnalysis}\n\n✅ Lo guardé en el historial de ${petName}.`
      : `📸 Esto es lo que observé en la imagen:\n\n${imageAnalysis}`;


    return {
      received: true,
      processed: true,
      from: parsed.from,
      user,
      conversation,
      reply,
      ...parsed,
      session: imageSession,
    };
  }

  let previous = getSession(parsed.from);
  logger.info("[Conversation] Current step:", previous.step ?? "(none)");

  if (previous.step === "completed") {
    // Limpia también los datos de la reserva ya cerrada — dejar step: null sin
    // limpiar el resto hacía que un mensaje posterior sin relación (ej. "Gracias")
    // reutilizara pet_name/requested_service de la cita ya agendada y disparara
    // una nueva oferta de horario. Mismo criterio de reinicio ya usado por la
    // rama de saludo en conversation.service.js.
    previous = {
      ...previous,
      step: null,
      pet_name: null,
      pet_type: null,
      requested_service: null,
      grooming_service: null,
      scheduling_date_key: null,
      scheduling_hour: null,
      date: null,
      time: null,
      domicilio: null,
      domicilio_address: null,
    };
  }

  if (scheduling.detectHumanEscalation(parsed.text)) {
    const reply =
      "Entiendo 😊\nVoy a escalar tu solicitud directamente con Lina 🐾";
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
    };
  }

  if (
    previous.step === "awaiting_confirmation" &&
    isConfirmationMessage(parsed.text)
  ) {
    const dateKey = previous.scheduling_date_key;
    const hour = previous.scheduling_hour;

    if (user && dateKey != null && hour != null) {
      try {
        // Para grooming usar el sub-servicio específico si está disponible
        const serviceType = previous.grooming_service
          ? previous.grooming_service
          : mapSessionServiceType(previous.requested_service);
        const appointmentDate = buildAppointmentDateTime(dateKey, hour);

        const hasConflict = await checkAppointmentConflict({
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

        const appointment = await createAppointment({
          userId: user.id,
          tenantId: user.tenantId || null,
          petName: await resolveAppointmentPetName(previous.pet_name, user.id),
          petType: previous.pet_type || "other",
          serviceType,
          date: appointmentDate,
          status: "confirmed",
          address: previous.domicilio_address || null,
          groomingBreed: previous.grooming_breed || null,
          groomingSize: previous.grooming_size || null,
        });

        logger.info(
          `[WhatsApp] Appointment persisted: ${appointment.id} (${dateKey} ${hour}h ${formatSlotForUser(dateKey, hour)}, ${serviceType})`
        );

        const slotLabel = formatSlotForUser(dateKey, hour);
        const { reply: defaultReply, step, sessionPatch } = getConfirmationReply();
        const reply = slotLabel
          ? `¡Listo! Tu cita quedó agendada ${slotLabel} 🐾 ¡Te esperamos en Mateos Pet!`
          : defaultReply;
        const session = updateSession(parsed.from, {
          ...previous,
          step,
          ...(sessionPatch || {}),
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
          appointment,
          reply,
          ...parsed,
          session,
        };
      } catch (error) {
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

    const { reply, step, sessionPatch } = getConfirmationReply();
    const session = updateSession(parsed.from, {
      ...previous,
      step,
      ...(sessionPatch || {}),
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
  if (user?.id) {
    try {
      const memories = await searchRelevantMemories({
        userId: user.id,
        query: parsed.text,
        limit: 5,
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
  if (tenantId) {
    try {
      const knowledge = await searchRelevantKnowledge({
        tenantId,
        query: parsed.text,
        limit: 5,
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
    });
  } catch (error) {
    logger.error("[WhatsApp] Error al analizar mensaje:", error.message);
  }

  logger.info("AI Analysis:", analysis);

  const mergedAnalysis = mergeSessionData(previous, analysis);

  // Captura pasiva del nombre del cliente (nunca sobrescribe uno existente)
  // — mismo criterio aditivo que la captura de mascota, sin alterar el flujo.
  if (user && !isEmptyValue(mergedAnalysis?.client_name)) {
    updateUserNameIfMissing(user.id, mergedAnalysis.client_name).catch((error) =>
      logger.error("[WhatsApp] Error al capturar nombre del cliente:", error.message)
    );
  }

  let pet = null;
  if (
    user &&
    !isEmptyValue(mergedAnalysis?.pet_name) &&
    !isEmptyValue(mergedAnalysis?.pet_type)
  ) {
    try {
      pet = await findOrCreatePet({
        name: mergedAnalysis.pet_name,
        type: mergedAnalysis.pet_type,
        ownerId: user.id,
      });
      logger.info(
        `[WhatsApp] Pet loaded: ${pet.id} (${pet.name}, ${pet.type})`
      );
    } catch (error) {
      logger.error("[WhatsApp] Error loading pet:", error.message);
    }
  }

  const result = await generateReply(
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
      // Entregable 6.2 (Fase 6) — transporta el tenantId ya disponible en
      // `user` hasta el motor de disponibilidad (Tenant.businessHours real).
      tenantId: user?.tenantId ?? null,
    }
  );

  // Grooming: la cita se crea al confirmar domicilio (no por awaiting_confirmation)
  if (result.createGroomingAppointment && user) {
    const sessionForAppt = { ...previous, ...(result.sessionPatch || {}) };
    const dateKey = previous.scheduling_date_key;
    const hour = previous.scheduling_hour;
    if (dateKey != null && hour != null) {
      try {
        const serviceType = previous.grooming_service || "grooming";
        const appointmentDate = buildAppointmentDateTime(dateKey, Number(hour));
        await createAppointment({
          userId: user.id,
          tenantId: user.tenantId || null,
          petName: await resolveAppointmentPetName(previous.pet_name, user.id),
          petType: previous.pet_type || "other",
          serviceType,
          date: appointmentDate,
          status: "confirmed",
          address: sessionForAppt.domicilio_address || null,
          groomingBreed: previous.grooming_breed || null,
          groomingSize: previous.grooming_size || null,
        });
        logger.info(`[WhatsApp] Grooming appointment created: ${dateKey} ${hour}h ${serviceType}`);
      } catch (error) {
        logger.error("[WhatsApp] Error creating grooming appointment:", error.message);
      }
    } else {
      logger.warn("[WhatsApp] Grooming appointment skipped — missing scheduling_date_key or hour");
    }
  }

  const session = updateSession(parsed.from, {
    ...mergedAnalysis,
    step: result.step,
    ...(result.sessionPatch || {}),
  });

  logger.info("[Conversation] New step:", session.step);
  logger.info("Generated reply:", result.reply);
  logger.info("Session:", session);

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
  };
};

// Entregable 8.1 (D-E5): punto de entrada real, mismo nombre/contrato externo
// que antes (webhook.controller.js → receptionist → engine adapter siguen
// invocando processIncomingMessage(body) esperando un único resultado con
// {from, reply, user, conversation}). Internamente ahora procesa TODOS los
// mensajes del batch en orden — cada uno se persiste y actualiza sesión con
// normalidad — pero solo el resultado del último se retorna para responder,
// preservando el contrato de una única respuesta por webhook. Los mensajes
// intermedios de un batch ya no se pierden en silencio (antes: descartados
// sin persistir ni actualizar sesión); solo su respuesta individual no se
// envía por separado — limitación conocida, documentada en el Gate Review
// de 8.1, no resuelta en este entregable (exigiría cambiar el contrato de
// respuesta única de webhook.controller.js).
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
  for (const parsed of messages) {
    result = await runExclusive(parsed.from, () => processSingleIncomingMessage(parsed));
  }

  return result;
};

module.exports = {
  verifyWebhookSignature,
  parseIncomingMessage,
  parseIncomingMessages,
  processIncomingMessage,
};
