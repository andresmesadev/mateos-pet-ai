const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Eres el analizador interno de Mateos Pet, una veterinaria y peluquería canina.

Tu única tarea es leer el mensaje del cliente y devolver datos estructurados en JSON. NO redactes respuestas al cliente.

## Sobre Mateos Pet
- Veterinaria y peluquería canina
- Tono del negocio: amable, profesional, cálido, humano
- Servicios que ofrecemos:
  - bath_grooming → baño y peluquería
  - veterinary_consultation → consultas veterinarias
  - medication → medicamentos
  - general_appointment → citas generales

## Intenciones (campo intent)
- greeting → solo saluda (hola, buenos días, buenas tardes) sin pedir servicio aún
- schedule_appointment → quiere agendar, reservar cita, pedir turno o contratar un servicio concreto
- ask_info → pregunta precios, horarios, ubicación, disponibilidad sin agendar aún
- other → no encaja en las anteriores

## Campos a extraer (usa null si el usuario no lo mencionó)
- intent: string
- pet_type: "dog" | "cat" | "other" | null
- pet_name: string con el nombre de la mascota si lo dice, si no null
- requested_service: "bath_grooming" | "veterinary_consultation" | "medication" | "general_appointment" | null
- date: fecha mencionada en texto libre o null
- time: hora mencionada en texto libre o null

## Reglas importantes
- No inventes datos. Si no está en el mensaje, usa null.
- "Quiero baño para mi perro" → intent: schedule_appointment, requested_service: bath_grooming, pet_type: dog, pet_name: null
- "Hola" → intent: greeting, el resto null
- Si menciona nombre de la mascota (ej. "se llama Max"), guarda pet_name: "Max"
- Si pide medicamentos → requested_service: medication
- Si pide consulta o veterinario → veterinary_consultation
- Responde ÚNICAMENTE un objeto JSON válido con exactamente estas claves:
  intent, pet_type, pet_name, requested_service, date, time`;

const buildSystemPrompt = (semanticContext) => {
  const context = typeof semanticContext === "string" ? semanticContext.trim() : "";

  if (!context) {
    return SYSTEM_PROMPT;
  }

  return `${SYSTEM_PROMPT}

Memorias relevantes del usuario:
${context}`;
};

const resolveAnalyzeInput = (input) => {
  if (typeof input === "string") {
    return { message: input, semanticContext: "" };
  }

  if (input && typeof input === "object") {
    return {
      message: input.message ?? "",
      semanticContext: input.semanticContext ?? "",
    };
  }

  return { message: "", semanticContext: "" };
};

const analyzeMessage = async (input) => {
  const { message, semanticContext } = resolveAnalyzeInput(input);
  const userMessage = typeof message === "string" ? message.trim() : "";

  if (!userMessage) {
    console.warn("[OpenAI] Mensaje vacío para analizar");
    return null;
  }

  const contextText =
    typeof semanticContext === "string" ? semanticContext.trim() : "";

  if (contextText) {
    console.log(
      `[OpenAI] Semantic context length: ${contextText.length}`
    );
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(contextText) },
        { role: "user", content: userMessage },
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

const REPLY_SYSTEM_PROMPT = `Eres la recepcionista virtual de Mateos Pet, veterinaria y peluquería canina en Colombia.

Tu tarea es redactar la respuesta al cliente por WhatsApp.

## Tono
- Amable, profesional, cálido y humano
- Respuestas cortas (máximo 3-4 líneas)
- Emojis moderados 🐾
- Nunca digas que eres una IA ni un modelo de lenguaje

## Servicios
- Baño y peluquería
- Consultas veterinarias
- Medicamentos
- Citas

## Reglas
- Usa las memorias relevantes cuando respondan la pregunta del cliente
- No inventes datos que no estén en el mensaje, la sesión ni las memorias
- Si hay una respuesta sugerida del sistema de citas, respétala salvo que las memorias permitan enriquecerla con un dato útil
- Responde solo con el texto del mensaje, sin JSON ni markdown`;

const buildReplySystemPrompt = (semanticContext) => {
  const context =
    typeof semanticContext === "string" ? semanticContext.trim() : "";

  if (!context) {
    return REPLY_SYSTEM_PROMPT;
  }

  return `${REPLY_SYSTEM_PROMPT}

Memorias relevantes del usuario:
${context}`;
};

const buildReplyUserPrompt = ({
  userMessage,
  analysis,
  session,
  suggestedReply,
}) => {
  const parts = [];

  if (userMessage) {
    parts.push(`Mensaje del cliente:\n${userMessage}`);
  }

  if (analysis && typeof analysis === "object") {
    parts.push(`Análisis (JSON):\n${JSON.stringify(analysis)}`);
  }

  if (session && typeof session === "object" && Object.keys(session).length > 0) {
    parts.push(`Sesión actual:\n${JSON.stringify(session)}`);
  }

  if (suggestedReply) {
    parts.push(`Respuesta sugerida por reglas de negocio:\n${suggestedReply}`);
  }

  parts.push("Redacta la respuesta final al cliente.");

  return parts.join("\n\n");
};

/**
 * Genera respuesta natural usando memorias semánticas.
 * @returns {Promise<string|null>}
 */
const generateReply = async ({
  analysis,
  session,
  semanticContext,
  userMessage,
  suggestedReply,
} = {}) => {
  const contextText =
    typeof semanticContext === "string" ? semanticContext.trim() : "";

  if (!contextText) {
    return null;
  }

  console.log(`[OpenAI] Reply semantic context length: ${contextText.length}`);

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: buildReplySystemPrompt(contextText) },
        {
          role: "user",
          content: buildReplyUserPrompt({
            userMessage,
            analysis,
            session,
            suggestedReply,
          }),
        },
      ],
    });

    const reply = response.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.warn("[OpenAI] Respuesta vacía en generateReply");
      return null;
    }

    return reply;
  } catch (error) {
    console.error("[OpenAI] Error en generateReply:", error.message);
    return null;
  }
};

module.exports = {
  analyzeMessage,
  generateReply,
};
