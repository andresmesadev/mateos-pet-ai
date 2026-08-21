/**
 * Corrección del bug "Gracias" (motor conversacional): tras completar una
 * reserva (session.step === STEPS.COMPLETED), el siguiente mensaje del
 * cliente debía saludar de nuevo sin reofrecer disponibilidad — la rama
 * comparaba analysis.step (siempre undefined, la IA no extrae "step" de un
 * mensaje suelto) en vez de currentStep (session.step). Reproduce
 * exactamente el escenario real: sesión con datos de una cita ya agendada
 * (pet_name/requested_service todavía en memoria) + un mensaje de
 * agradecimiento sin relación con agendar.
 */
jest.mock("../../services/domain/medical-auto-capture.service", () => ({
  trySaveMedicalInfo: jest.fn().mockResolvedValue(null),
}));

const { generateReply, STEPS } = require("../../services/conversation.service");

describe("generateReply — flujo completado", () => {
  test("tras COMPLETED, un mensaje de agradecimiento saluda de nuevo sin reofrecer un slot", async () => {
    const session = {
      step: STEPS.COMPLETED,
      pet_name: "Benji patricio",
      pet_type: "dog",
      requested_service: "bath_grooming",
      scheduling_date_key: "2026-08-22",
      scheduling_hour: 10,
    };

    const result = await generateReply({
      analysis: { intent: "other" },
      session,
      semanticContext: "",
      userMessage: "Gracias",
    });

    expect(result.reply).toBe("¡Hola de nuevo! 😊 Soy Lina, ¿en qué te podemos colaborar hoy? 🐾");
    expect(result.step).toBeNull();
    expect(result.reply).not.toMatch(/disponibilidad/i);
  });

  test("sin session.step (conversación nueva), un mensaje suelto no cae en la rama de completado", async () => {
    const result = await generateReply({
      analysis: { intent: "other" },
      session: {},
      semanticContext: "",
      userMessage: "Gracias",
    });

    expect(result.reply).not.toBe("¡Hola de nuevo! 😊 Soy Lina, ¿en qué te podemos colaborar hoy? 🐾");
  });
});
