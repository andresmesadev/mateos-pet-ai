const { analyzeMessage } = require("./openai.service");
const {
  generateReply,
  getConfirmationReply,
  isConfirmationMessage,
} = require("./conversation.service");
const { getSession, updateSession } = require("./memory.service");
const scheduling = require("./scheduling.service");

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

  if (!from || !text) {
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

  console.log(`New message from: ${parsed.from}`);
  console.log(`Message: ${parsed.text}`);

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

    return {
      received: true,
      processed: true,
      from: parsed.from,
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
    const session = updateSession(parsed.from, {
      ...previous,
      step,
      ...(sessionPatch || {}),
    });

    console.log("[Conversation] New step:", session.step);
    console.log("Generated reply:", reply);

    return {
      received: true,
      processed: true,
      from: parsed.from,
      reply,
      ...parsed,
      session,
    };
  }

  let analysis = null;
  try {
    analysis = await analyzeMessage(parsed.text);
  } catch (error) {
    console.error("[WhatsApp] Error al analizar mensaje:", error.message);
  }

  console.log("AI Analysis:", analysis);

  const mergedAnalysis = mergeSessionData(previous, analysis);
  const result = generateReply(mergedAnalysis, {
    mockAppointments: scheduling.getMockAppointments(),
    now: new Date(),
  });
  const session = updateSession(parsed.from, {
    ...mergedAnalysis,
    step: result.step,
    ...(result.sessionPatch || {}),
  });

  console.log("[Conversation] New step:", session.step);
  console.log("Generated reply:", result.reply);
  console.log("Session:", session);

  return {
    received: true,
    processed: true,
    from: parsed.from,
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
