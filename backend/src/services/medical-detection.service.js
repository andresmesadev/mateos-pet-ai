const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const VALID_TYPES = new Set(["allergy", "vaccine", "consultation", "note"]);

const MEDICAL_EXTRACTION_PROMPT = `Eres un extractor de información médica veterinaria para Mateos Pet (Colombia).

Analiza el mensaje del cliente sobre su mascota y extrae datos médicos si los hay.

Tipos permitidos (campo type):
- allergy → alergias, intolerancias, cosas que no puede comer
- vaccine → vacunas aplicadas o pendientes
- consultation → consultas, diagnósticos o visitas veterinarias previas
- note → otra información médica relevante (medicación crónica, condiciones, etc.)

Reglas:
- Si NO hay información médica clara, responde has_medical_info: false y el resto null.
- No inventes datos. Solo extrae lo que el mensaje dice.
- title: resumen corto en español (ej. "Alergia al pollo", "Vacuna rabia", "Consulta dermatológica")
- detail: descripción adicional útil o null
- date: fecha mencionada en formato YYYY-MM-DD o null (ej. "ayer", "el lunes" → null si no hay fecha concreta)
- Responde ÚNICAMENTE JSON válido con estas claves:
  has_medical_info, type, title, detail, date`;

const normalizeExtractedDate = (value) => {
  if (value == null || value === "") {
    return null;
  }

  const text = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const parsed = new Date(`${text}T12:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return text;
};

const normalizeExtractedRecord = (payload) => {
  if (!payload || payload.has_medical_info !== true) {
    return null;
  }

  const type = String(payload.type || "")
    .trim()
    .toLowerCase();
  const title = String(payload.title || "").trim();
  const detail = String(payload.detail ?? "").trim() || null;
  const date = normalizeExtractedDate(payload.date);

  if (!VALID_TYPES.has(type) || !title) {
    return null;
  }

  return { type, title, detail, date };
};

/**
 * Extrae información médica estructurada del mensaje.
 * @param {string} message
 * @returns {Promise<{ type: string, title: string, detail: string|null, date: string|null }|null>}
 */
const detectMedicalInfo = async (message) => {
  const userMessage = typeof message === "string" ? message.trim() : "";

  if (!userMessage) {
    return null;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MEDICAL_EXTRACTION_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    const record = normalizeExtractedRecord(parsed);

    if (record) {
      console.log("[MedicalDetection] Medical info detected:", record.type, record.title);
    }

    return record;
  } catch (error) {
    console.error("[MedicalDetection] detectMedicalInfo error:", error.message);
    return null;
  }
};

module.exports = {
  detectMedicalInfo,
};
