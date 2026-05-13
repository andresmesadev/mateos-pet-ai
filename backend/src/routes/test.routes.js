const express = require("express");
const { analyzeMessage } = require("../services/openai.service");
const { generateReply } = require("../services/conversation.service");

const router = express.Router();

router.post("/analyze", async (req, res, next) => {
  try {
    const { message } = req.body || {};

    if (typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "El campo 'message' es requerido y debe ser un string no vacío",
      });
    }

    const analysis = await analyzeMessage(message);
    const reply = generateReply(analysis);

    return res.status(200).json({
      success: true,
      analysis,
      reply,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
