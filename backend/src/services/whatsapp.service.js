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
const { findOrCreateUser } = require("./user.service");
const { findOrCreatePet, findPetByNameAndOwner } = require("./pet.service");
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
  syncConversationState,
} = require("./conversation-persistence.service");
const {
  searchRelevantMemories,
  buildSemanticContext,
} = require("./semantic-memory.service");
const { processVoiceMessage } = require("./audio.service");
const { processImageMessage } = require("./image.service");
const { createRecord } = require("./medical-record.service");
const { getTenantByPhone } = require("./tenant.service");

const persistUserMessage = async (user, conversation, content) => {
  if (!user?.id || !conversation?.id || !content) return;

  try {
    await saveMessage({
      conversationId: conversation.id,
      userId: user.id,
      role: "user",
      content,
    });
    logger.info("[WhatsApp] Message persisted");
  } catch (error) {
    logger.error("[WhatsApp] Error persisting user message:", error.message);
  }
};

const persistAssistantMessage = async (conversation, content) => {
  if (!conversation?.id || !content) return;

  try {
    await saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      content,
    });
    logger.info("[WhatsApp] Message persisted");
  } catch (error) {
    logger.error(
      "[WhatsApp] Error persisting assistant message:",
      error.message
    );
  }
};

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

const parseIncomingMessage = (body) => {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (!message) {
    return null;
  }

  const from = message.from;

  if (!from) {
    return null;
  }

  // phone_number_id identifica la línea WhatsApp Business (= un tenant)
  const phoneNumberId =
    value?.metadata?.phone_number_id ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    null;

  if (message.type === "audio" && message.audio?.id) {
    return {
      from,
      text: null,
      type: "audio",
      mediaId: message.audio.id,
      phoneNumberId,
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
    };
  }

  if (message.type === "document") {
    return { from, text: null, type: "document", phoneNumberId };
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

  return { from, text, type: message.type, phoneNumberId };
};

const processIncomingMessage = async (body) => {
  const parsed = parseIncomingMessage(body);

  if (!parsed) {
    logger.info("[WhatsApp] Payload ignorado (sin mensaje de texto soportado)");
    return { received: true, processed: false };
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

  if (parsed.type === "document") {
    logger.info("[WhatsApp] Document message received — not supported");
    return {
      received: true,
      processed: true,
      from: parsed.from,
      reply:
        "Solo proceso imágenes 📸\nSi quieres compartir información médica, envíame una foto o escríbeme un mensaje.",
    };
  }

  logger.info(`New message from: ${parsed.from}`);
  logger.info(`Message: ${parsed.text}`);

  // Identificar tenant por el phone_number_id de la línea WhatsApp Business
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
      await persistUserMessage(user, conversation, parsed.text);
    } catch (error) {
      logger.error("[WhatsApp] Error loading conversation:", error.message);
    }
  }

  if (parsed.type === "image" && parsed.mediaId) {
    logger.info("[WhatsApp] Image message detected");

    const imageSession = getSession(parsed.from);
    const petName = imageSession?.pet_name;

    if (!petName) {
      const reply =
        "Recibí tu imagen 📸 ¿De qué mascota es? Dime su nombre para guardarla en el historial médico.";
      await persistAssistantMessage(conversation, reply);
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
      await persistAssistantMessage(conversation, reply);
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

    await persistAssistantMessage(conversation, reply);

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
    previous = { ...previous, step: null };
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

    await persistAssistantMessage(conversation, reply);
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
        const serviceType = mapSessionServiceType(previous.requested_service);
        const appointmentDate = buildAppointmentDateTime(dateKey, hour);

        const hasConflict = await checkAppointmentConflict({
          date: appointmentDate,
          serviceType,
          dateKey,
          hour,
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

          await persistAssistantMessage(conversation, reply);
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
          petName: previous.pet_name || "Mascota",
          petType: previous.pet_type || "other",
          serviceType,
          date: appointmentDate,
          status: "confirmed",
        });

        logger.info(
          `[WhatsApp] Appointment persisted: ${appointment.id} (${dateKey} ${hour}h ${formatSlotForUser(dateKey, hour)}, ${serviceType})`
        );

        const slotLabel = formatSlotForUser(dateKey, hour);
        const { reply: defaultReply, step, sessionPatch } = getConfirmationReply();
        const reply = slotLabel
          ? `¡Perfecto! 😊 Tu cita quedó confirmada en Mateos Pet 🐾\n${slotLabel}.`
          : defaultReply;
        const session = updateSession(parsed.from, {
          ...previous,
          step,
          ...(sessionPatch || {}),
        });

        logger.info("[Conversation] New step:", session.step);
        logger.info("Generated reply:", reply);

        await persistAssistantMessage(conversation, reply);
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

        await persistAssistantMessage(conversation, reply);
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

    await persistAssistantMessage(conversation, reply);
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

  let analysis = null;
  try {
    analysis = await analyzeMessage({
      message: parsed.text,
      semanticContext,
    });
  } catch (error) {
    logger.error("[WhatsApp] Error al analizar mensaje:", error.message);
  }

  logger.info("AI Analysis:", analysis);

  const mergedAnalysis = mergeSessionData(previous, analysis);

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
    },
    {
      now: new Date(),
      userId: user?.id,
    }
  );
  const session = updateSession(parsed.from, {
    ...mergedAnalysis,
    step: result.step,
    ...(result.sessionPatch || {}),
  });

  logger.info("[Conversation] New step:", session.step);
  logger.info("Generated reply:", result.reply);
  logger.info("Session:", session);

  await persistAssistantMessage(conversation, result.reply);
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

module.exports = {
  verifyWebhookSignature,
  parseIncomingMessage,
  processIncomingMessage,
};
