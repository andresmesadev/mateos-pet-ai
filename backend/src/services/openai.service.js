const OpenAI = require("openai");

let _client = null;

const getClient = () => {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Entregable 8.1 (D-F2): un 429/503 transitorio ya no pierde el turno
      // completo del cliente — el SDK reintenta con backoff exponencial
      // nativo antes de propagar el error al catch de cada llamada.
      maxRetries: 2,
    });
  }

  return _client;
};

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
- cancel_appointment → quiere cancelar una cita existente (ej. "cancelar cita", "no puedo ir", "quiero cancelar")
- reschedule_appointment → quiere cambiar o reprogramar una cita (ej. "reprogramar", "cambiar cita", "cambiar horario", "otro día")
- query_appointments → quiere consultar sus citas activas (ej. "¿cuál es mi cita?", "¿cuándo tengo cita?", "mis citas", "¿tengo cita pendiente?")
- query_medical_history → quiere consultar el historial médico de su mascota (alergias, vacunas, consultas, notas)
- save_medical_info → comparte información médica de su mascota (alergias, vacunas, consultas previas, restricciones alimentarias, tratamientos)
- ask_info → pregunta precios, horarios, ubicación, disponibilidad sin agendar aún
- other → no encaja en las anteriores

## Campos a extraer (usa null si el usuario no lo mencionó)
- intent: string
- pet_type: "dog" | "cat" | "other" | null
- pet_name: string con el nombre de la mascota si lo dice, si no null
- client_name: string con el nombre de la PERSONA (el dueño, no la mascota) si lo dice, si no null
- requested_service: "bath_grooming" | "veterinary_consultation" | "medication" | "general_appointment" | null
- date: fecha mencionada en texto libre o null
- time: hora mencionada en texto libre o null

## Reglas importantes
- No inventes datos. Si no está en el mensaje, usa null.
- "Quiero baño para mi perro" → intent: schedule_appointment, requested_service: bath_grooming, pet_type: dog, pet_name: null
- "Hola" → intent: greeting, el resto null
- Si menciona nombre de la mascota (ej. "se llama Max"), guarda pet_name: "Max"
- Si el cliente dice su propio nombre (ej. "Soy Juan", "Mi nombre es María", "Habla Carlos"), guarda client_name: "Juan" — nunca confundas el nombre de la persona con el de la mascota
- Si pide medicamentos → requested_service: medication
- Si pide consulta o veterinario → veterinary_consultation
- "Quiero cancelar mi cita" → intent: cancel_appointment
- "Necesito reprogramar" o "cambiar horario" → intent: reschedule_appointment
- "¿Cuál es mi cita?" o "mis citas" → intent: query_appointments
- "¿Qué alergias tiene Max?" → intent: query_medical_history, pet_name: "Max"
- "¿Cuándo fue vacunado Luna?" → intent: query_medical_history, pet_name: "Luna"
- "historial médico de mi perro" → intent: query_medical_history
- "¿qué tiene anotado de Max?" → intent: query_medical_history, pet_name: "Max"
- "¿a qué es alérgico mi gato?" → intent: query_medical_history, pet_type: cat
- "Mi perro tiene alergia al pollo" → intent: save_medical_info
- "Max fue vacunado contra la rabia" → intent: save_medical_info, pet_name: "Max"
- "Luna tuvo una consulta dermatológica" → intent: save_medical_info, pet_name: "Luna"
- "Mi gato no puede comer pescado" → intent: save_medical_info
- "Le pusieron la vacuna antirrábica ayer" → intent: save_medical_info
- Responde ÚNICAMENTE un objeto JSON válido con exactamente estas claves:
  intent, pet_type, pet_name, client_name, requested_service, date, time`;

const buildSystemPrompt = (semanticContext) => {
  const context = typeof semanticContext === "string" ? semanticContext.trim() : "";

  if (!context) {
    return SYSTEM_PROMPT;
  }

  return `${SYSTEM_PROMPT}

Memorias relevantes del usuario:
${context}`;
};

// Entregable 8.1 (D-M1): normaliza `history` a un array de
// { role: "user"|"assistant", content } — mismo formato ya validado por
// context-builder.service.js. Cualquier entrada que no sea un array la
// vacía en vez de fallar — ausencia de historial nunca rompe el análisis.
const normalizeHistory = (history) =>
  Array.isArray(history)
    ? history.filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim()
      )
    : [];

const resolveAnalyzeInput = (input) => {
  if (typeof input === "string") {
    return { message: input, semanticContext: "", history: [] };
  }

  if (input && typeof input === "object") {
    return {
      message: input.message ?? "",
      semanticContext: input.semanticContext ?? "",
      history: normalizeHistory(input.history),
    };
  }

  return { message: "", semanticContext: "", history: [] };
};

const analyzeMessage = async (input) => {
  const { message, semanticContext, history } = resolveAnalyzeInput(input);
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
    // Entregable 8.1 (D-M1): el historial ya no se descarta — se inserta
    // entre el system prompt y el mensaje actual. Antes: siempre exactamente
    // dos mensajes (system+user), sin memoria de turnos previos.
    const response = await getClient().chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(contextText) },
        ...history,
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

const REPLY_SYSTEM_PROMPT = `Eres Lina, recepcionista de Mateos Pet, veterinaria y peluquería canina en Colombia.

Tu tarea es redactar la respuesta al cliente por WhatsApp como si fueras una persona real llamada Lina.

## Personalidad
- Te llamas Lina, eres cálida, amable y profesional
- Jamás digas que eres una IA, bot o asistente virtual — eres Lina, una persona real
- Habla en primera persona del plural cuando hablas de la clínica ("podemos", "tenemos", "te esperamos")
- Habla en primera persona singular cuando te refieres a ti misma ("yo te ayudo", "me dices", "te cuento")

## Tono
- Cercano, cálido y natural — como un mensaje de WhatsApp de alguien de confianza
- Respuestas cortas (máximo 3-4 líneas)
- Emojis moderados 🐾 😊

## Servicios
- Baño y peluquería
- Consultas veterinarias
- Medicamentos
- Citas

## Reglas
- Usa las memorias relevantes cuando respondan la pregunta del cliente
- No inventes datos que no estén en el mensaje, la sesión ni las memorias
- Si hay una respuesta sugerida del sistema, respétala y adáptala a tu tono natural de Lina
- Si el cliente pregunta por Lina o pide hablar con una persona, di que ya está hablando con ella
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
  history,
} = {}) => {
  const normalizedHistory = normalizeHistory(history);
  const contextText =
    typeof semanticContext === "string" ? semanticContext.trim() : "";

  // Entregable 8.1 (D-F4): ya no se corta aquí sin contexto semántico — el
  // llamador (conversation.service.js) decide si vale la pena intentar
  // redactar con IA; esta función solo arma el prompt con lo que reciba.
  if (contextText) {
    console.log(`[OpenAI] Reply semantic context length: ${contextText.length}`);
  }

  try {
    // Entregable 8.1 (D-M1): mismo criterio que analyzeMessage — el historial
    // se inserta antes del mensaje actual (que sigue siendo el "resumen"
    // enriquecido de buildReplyUserPrompt, no el texto crudo, para no
    // duplicar el turno actual dos veces en el prompt).
    const response = await getClient().chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: buildReplySystemPrompt(contextText) },
        ...normalizedHistory,
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
