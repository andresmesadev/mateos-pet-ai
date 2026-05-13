const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an AI assistant for a veterinary clinic.
Analyze the user message and detect:
- intent
- pet type
- requested service
- date
- time

Return ONLY valid JSON.`;

const analyzeMessage = async (message) => {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      console.warn("[OpenAI] Respuesta vacía del modelo");
      return null;
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error("[OpenAI] No se pudo parsear JSON:", content);
      return null;
    }
  } catch (error) {
    console.error("[OpenAI] Error al analizar mensaje:", error.message);
    return null;
  }
};

module.exports = {
  analyzeMessage,
};
