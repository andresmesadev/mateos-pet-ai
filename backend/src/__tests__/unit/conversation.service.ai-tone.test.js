/**
 * Mejora post-Fase 8 (2026-09-08): shouldUseRuleReplyOnly ya no bloquea las
 * respuestas que avanzan el wizard de reserva (step en BOOKING_STEPS) — antes
 * de este cambio, prácticamente toda una reserva real (nombre de mascota,
 * tipo, horario, domicilio) salía como texto fijo idéntico siempre, sin pasar
 * nunca por generateReplyWithAI. Los intents de gestión (cancelar/
 * reprogramar/consultar) y las ramas con forceRuleReply explícito deben
 * seguir fijos — no formaban parte del hallazgo, no se tocaron.
 */
jest.mock("../../services/openai.service", () => ({
  generateReply: jest.fn(),
}));
jest.mock("../../services/domain/medical-auto-capture.service", () => ({
  trySaveMedicalInfo: jest.fn().mockResolvedValue(null),
}));
jest.mock("../../services/business-config.service", () => ({
  getBusinessHours: jest.fn(),
}));

const { generateReply: generateReplyWithAI } = require("../../services/openai.service");
const { getBusinessHours } = require("../../services/business-config.service");
const { generateReply, STEPS } = require("../../services/conversation.service");

beforeEach(() => jest.clearAllMocks());

describe("generateReply — el wizard de reserva ya es elegible para reformularse con IA", () => {
  test("pregunta de nombre de mascota (AWAITING_PET_NAME): usa la respuesta de la IA cuando está disponible", async () => {
    generateReplyWithAI.mockResolvedValue("¡Con gusto! ¿Cómo se llama tu compañero? 🐾");

    const result = await generateReply({
      analysis: { intent: "schedule_appointment", requested_service: "bath_grooming" },
      session: {},
      semanticContext: "",
      userMessage: "Quiero un baño para mi perro",
    });

    expect(result.step).toBe(STEPS.AWAITING_PET_NAME);
    expect(result.reply).toBe("¡Con gusto! ¿Cómo se llama tu compañero? 🐾");
    expect(generateReplyWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedReply: expect.stringContaining("¿Cómo se llama tu") })
    );
  });

  test("nombre real del cliente se pasa a generateReplyWithAI como clientName", async () => {
    generateReplyWithAI.mockResolvedValue(null);

    await generateReply(
      {
        analysis: { intent: "schedule_appointment", requested_service: "bath_grooming" },
        session: {},
        semanticContext: "",
        userMessage: "Quiero un baño para mi perro",
      },
      { userId: "user-1", userName: "María" }
    );

    expect(generateReplyWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: "María" })
    );
  });

  test("una fecha solicitada no validada no se convierte en promesa al pedir el nombre de la mascota", async () => {
    generateReplyWithAI.mockResolvedValue("Te agendo el domingo a las 12");

    const result = await generateReply({
      analysis: {
        intent: "schedule_appointment",
        requested_service: "vet",
        pet_type: "dog",
        date: "2026-09-27",
        time: "12:00",
      },
      session: {},
      semanticContext: "",
      userMessage: "Quiero cita el domingo a las 12 para mi perro",
    });

    expect(result.step).toBe(STEPS.AWAITING_PET_NAME);
    expect(result.reply).toContain("¿Cómo se llama tu perrito?");
    expect(result.reply).not.toContain("Te agendo");
    expect(generateReplyWithAI).not.toHaveBeenCalled();
  });

  test("si la IA falla, cae al texto de reglas (mismo dato, sin romper la reserva)", async () => {
    generateReplyWithAI.mockRejectedValue(new Error("OpenAI caído"));

    const result = await generateReply({
      analysis: { intent: "schedule_appointment", requested_service: "bath_grooming" },
      session: {},
      semanticContext: "",
      userMessage: "Quiero un baño para mi perro",
    });

    expect(result.step).toBe(STEPS.AWAITING_PET_NAME);
    expect(result.reply).toContain("¿Cómo se llama tu");
  });

  test("intent de gestión (cancelar) sigue fijo — la IA no se invoca", async () => {
    const result = await generateReply({
      analysis: { intent: "cancel_appointment" },
      session: {},
      semanticContext: "",
      userMessage: "quiero cancelar mi cita",
    });

    expect(generateReplyWithAI).not.toHaveBeenCalled();
    expect(result.reply).toContain("cancel");
  });

  test("saludo (forceRuleReply explícito) sigue fijo — la IA no se invoca", async () => {
    const result = await generateReply({
      analysis: { intent: "greeting" },
      session: {},
      semanticContext: "",
      userMessage: "hola",
    });

    expect(generateReplyWithAI).not.toHaveBeenCalled();
    expect(result.reply).toContain("Lina");
  });

  test("vacunación sin cita no promete atención en domingos o festivos", async () => {
    const result = await generateReply({
      analysis: { intent: "ask_info" },
      session: {},
      semanticContext: "",
      userMessage: "¿Necesito cita para vacunar a mi perro?",
    });

    expect(result.reply).toContain("días cerrados y festivos");
    expect(result.reply).not.toContain("cualquier día");
    expect(generateReplyWithAI).not.toHaveBeenCalled();
  });

  test("la pregunta por horarios responde con la configuración real de ambos servicios", async () => {
    const days = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat"].map((day) => [day, { active: true, open: "11:00", close: "17:00" }]));
    days.sun = { active: false, open: "11:00", close: "17:00" };
    getBusinessHours.mockResolvedValue({ services: { vet: days, grooming: days } });

    const result = await generateReply({
      analysis: { intent: "ask_info" },
      session: {},
      semanticContext: "",
      userMessage: "¿Cuál es el horario que manejan?",
    }, { tenantId: "t-1" });

    expect(result.reply).toContain("Veterinaria:");
    expect(result.reply).toContain("Peluquería:");
    expect(result.reply).toContain("11:00–17:00");
    expect(result.reply).not.toContain("domingo de");
    expect(getBusinessHours).toHaveBeenCalledWith("t-1");
    expect(generateReplyWithAI).not.toHaveBeenCalled();
  });
});
