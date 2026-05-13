const express = require("express");
const { analyzeMessage } = require("../services/openai.service");
const { generateReply } = require("../services/conversation.service");
const { getSession, updateSession } = require("../services/memory.service");

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

    const analysis = await analyzeMessage(message);

    const previous = getSession(phone);
    const mergedAnalysis = mergeSessionData(previous, analysis);
    const session = updateSession(phone, mergedAnalysis);

    const reply = generateReply(mergedAnalysis);

    return res.status(200).json({
      success: true,
      session,
      reply,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
