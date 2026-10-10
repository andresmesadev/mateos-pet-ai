// Development-only extractor diagnostic. Never simulates or confirms a booking.
const express = require("express");
const { analyzeMessage } = require("../services/openai.service");
const router = express.Router();
router.post("/analyze", async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (typeof message !== "string" || !message.trim() || message.length > 4000) {
      return res.status(400).json({ success: false, message: "message debe ser texto de 1 a 4000 caracteres" });
    }
    const analysis = await analyzeMessage({ message, session: {}, history: [] });
    return res.status(200).json({ success: Boolean(analysis), analysis,
      reply: "Diagnóstico de extracción: no se creó ni modificó ninguna cita." });
  } catch (error) { next(error); }
});
module.exports = router;
