const { analyzeMessage } = require("./openai.service");
const {
  generateReply,
  getConfirmationReply,
  isConfirmationMessage,
} = require("./conversation.service");
const { getSession, updateSession } = require("./memory.service");
const scheduling = require("./scheduling.service");
const { findOrCreateUser } = require("./user.service");
const { findOrCreatePet } = require("./pet.service");
const {
  buildAppointmentDateTime,
  mapSessionServiceType,
  createAppointment,
  checkAppointmentConflict,
} = require("./appointment.service");
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

const persistUserMessage = async (user, conversation, content) => {
  if (!user?.id || !conversation?.id || !content) return;

  try {
    await saveMessage({
      conversationId: conversation.id,
      userId: user.id,
      role: "user",
      content,
    });
    console.log("[WhatsApp] Message persisted");
  } catch (error) {
    console.error("[WhatsApp] Error persisting user message:", error.message);
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
    console.log("[WhatsApp] Message persisted");
  } catch (error) {
    console.error(
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

  if (message.type === "audio" && message.audio?.id) {
    return {
      from,
      text: null,
      type: "audio",
      mediaId: message.audio.id,
    };
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

  return { from, text, type: message.type };
};

const processIncomingMessage = async (body) => {
  const parsed = parseIncomingMessage(body);

  if (!parsed) {
    console.log("[WhatsApp] Payload ignorado (sin mensaje de texto soportado)");
    return { received: true, processed: false };
  }

  if (parsed.type === "audio" && parsed.mediaId) {
    console.log("[WhatsApp] Voice message detected");

    const transcript = await processVoiceMessage(parsed.mediaId);

    if (!transcript) {
      console.log("[WhatsApp] Voice transcription failed");

      return {
        received: true,
        processed: false,
      };
    }

    parsed.text = transcript;
    parsed.type = "text";

    console.log("[WhatsApp] Voice transcription:", transcript);
  }

  console.log(`New message from: ${parsed.from}`);
  console.log(`Message: ${parsed.text}`);

  let user = null;
  try {
    user = await findOrCreateUser(parsed.from);
    console.log(
      `[WhatsApp] User loaded: ${user.id} (${user.phone})`
    );
  } catch (error) {
    console.error("[WhatsApp] Error loading user:", error.message);
  }

  let conversation = null;
  if (user) {
    try {
      conversation = await findOrCreateConversation(user.id);
      console.log(
        `[WhatsApp] Conversation loaded: ${conversation.id} (user ${user.id})`
      );
      await persistUserMessage(user, conversation, parsed.text);
    } catch (error) {
      console.error("[WhatsApp] Error loading conversation:", error.message);
    }
  }

  let previous = getSession(parsed.from);
  console.log("[Conversation] Current step:", previous.step ?? "(none)");

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
    console.log(
      "[scheduling] Sesión marcada requires_human_attention:",
      parsed.from
    );
    console.log("[Conversation] New step:", session.step ?? "(none)");

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
    const { reply, step, sessionPatch } = getConfirmationReply();

    let appointment = null;

    if (user) {
      const dateKey = previous.scheduling_date_key;
      const hour = previous.scheduling_hour;

      if (dateKey != null && hour != null) {
        try {
          const serviceType = mapSessionServiceType(
            previous.requested_service
          );
          const appointmentDate = buildAppointmentDateTime(dateKey, hour);

          const hasConflict = await checkAppointmentConflict({
            date: appointmentDate,
            serviceType,
          });

          if (hasConflict) {
            console.log(
              "[WhatsApp] Appointment conflict at confirm (persisting anyway)"
            );
          }

          appointment = await createAppointment({
            userId: user.id,
            petName: previous.pet_name || "Mascota",
            petType: previous.pet_type || "other",
            serviceType,
            date: appointmentDate,
            status: "confirmed",
          });

          scheduling.pushMockAppointment({
            date: dateKey,
            hour: Number(hour),
            serviceType,
          });

          console.log(
            `[WhatsApp] Appointment persisted: ${appointment.id} (${dateKey} ${hour}h, ${serviceType})`
          );
        } catch (error) {
          console.error(
            "[WhatsApp] Error persisting appointment:",
            error.message
          );
        }
      } else {
        console.log(
          "[WhatsApp] Confirmación sin scheduling_date_key/hour; cita no persistida"
        );
      }
    }

    const session = updateSession(parsed.from, {
      ...previous,
      step,
      ...(sessionPatch || {}),
    });

    console.log("[Conversation] New step:", session.step);
    console.log("Generated reply:", reply);

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
        console.log("[SemanticMemory] Context injected");
      }
    } catch (error) {
      console.error(
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
    console.error("[WhatsApp] Error al analizar mensaje:", error.message);
  }

  console.log("AI Analysis:", analysis);

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
      console.log(
        `[WhatsApp] Pet loaded: ${pet.id} (${pet.name}, ${pet.type})`
      );
    } catch (error) {
      console.error("[WhatsApp] Error loading pet:", error.message);
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
      mockAppointments: scheduling.getMockAppointments(),
      now: new Date(),
    }
  );
  const session = updateSession(parsed.from, {
    ...mergedAnalysis,
    step: result.step,
    ...(result.sessionPatch || {}),
  });

  console.log("[Conversation] New step:", session.step);
  console.log("Generated reply:", result.reply);
  console.log("Session:", session);

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
