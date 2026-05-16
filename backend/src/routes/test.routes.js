const express = require("express");
const { analyzeMessage } = require("../services/openai.service");
const {
  generateReply,
  getConfirmationReply,
  isConfirmationMessage,
} = require("../services/conversation.service");
const { getSession, updateSession } = require("../services/memory.service");
const scheduling = require("../services/scheduling.service");

const router = express.Router();

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

router.post("/analyze", async (req, res, next) => {
  try {
    const { message } = req.body || {};

    if (typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "El campo 'message' es requerido y debe ser un string no vacío",
      });
    }

    const phone = "573001234567";

    let previous = getSession(phone);
    console.log("[Conversation] Current step:", previous.step ?? "(none)");

    if (previous.step === "completed") {
      previous = { ...previous, step: null };
    }

    if (scheduling.detectHumanEscalation(message)) {
      const reply =
        "Entiendo 😊\nVoy a escalar tu solicitud directamente con Lina 🐾";
      const session = updateSession(phone, {
        ...previous,
        requires_human_attention: true,
        step: null,
      });
      console.log("[scheduling] Sesión marcada requires_human_attention (test)");

      return res.status(200).json({
        success: true,
        session,
        reply,
      });
    }

    if (
      previous.step === "awaiting_confirmation" &&
      isConfirmationMessage(message)
    ) {
      const { reply, step, sessionPatch } = getConfirmationReply();
      const session = updateSession(phone, {
        ...previous,
        step,
        ...(sessionPatch || {}),
      });
      console.log("[Conversation] New step:", session.step);

      return res.status(200).json({
        success: true,
        session,
        reply,
      });
    }

    const analysis = await analyzeMessage(message);

    const mergedAnalysis = mergeSessionData(previous, analysis);
    const result = await generateReply(
      {
        analysis: mergedAnalysis,
        session: previous,
        semanticContext: "",
        userMessage: message,
      },
      {
        mockAppointments: scheduling.getMockAppointments(),
        now: new Date(),
      }
    );
    const session = updateSession(phone, {
      ...mergedAnalysis,
      step: result.step,
      ...(result.sessionPatch || {}),
    });

    console.log("[Conversation] New step:", session.step);

    return res.status(200).json({
      success: true,
      session,
      reply: result.reply,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
