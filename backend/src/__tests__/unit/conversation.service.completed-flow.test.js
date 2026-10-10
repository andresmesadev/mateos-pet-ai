/**
 * Corrección del bug "Gracias" (motor conversacional): tras completar una
 * reserva (session.step === STEPS.COMPLETED), el siguiente mensaje del
 * cliente no debe reofrecer disponibilidad. La corrección de octubre además
 * agradece sin reiniciar el saludo. Originalmente la rama
 * comparaba analysis.step (siempre undefined, la IA no extrae "step" de un
 * mensaje suelto) en vez de currentStep (session.step). Reproduce
 * exactamente el escenario real: sesión con datos de una cita ya agendada
 * (pet_name/requested_service todavía en memoria) + un mensaje de
 * agradecimiento sin relación con agendar.
 */

const { generateReply, STEPS } = require("../../services/conversation.service");

describe("generateReply — flujo completado", () => {
  test.each([null, { intent: "greeting" }, { intent: "query_appointments" }])("un agradecimiento puro no depende de la clasificación del modelo: %j", async (analysis) => {
    const result = await generateReply({ analysis, session: {}, userMessage: "Muchas gracias" });
    expect(result.reply).toContain("¡Hasta pronto!");
    expect(result.step).toBeNull();
  });

  test("cliente nuevo: solicita el nombre antes de pedir datos de mascota", async () => {
    const result = await generateReply({
      analysis: { intent: "greeting" },
      session: {},
      semanticContext: "",
      userMessage: "Hola",
    }, { needsClientName: true });

    expect(result.step).toBe(STEPS.AWAITING_CLIENT_NAME);
    expect(result.reply).toMatch(/quién tengo el gusto/i);
  });

  test("guarda el nombre capturado y continúa", async () => {
    const result = await generateReply({
      analysis: { intent: "other", client_name: "Andrés" },
      session: { step: STEPS.AWAITING_CLIENT_NAME },
      semanticContext: "",
      userMessage: "Andrés",
    });

    expect(result.step).toBeNull();
    expect(result.sessionPatch.client_name).toBe("Andrés");
  });

  test("tras COMPLETED, agradece sin saludar de nuevo ni reofrecer un slot", async () => {
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

    expect(result.reply).toContain("¡Hasta pronto!");
    expect(result.step).toBeNull();
    expect(result.reply).not.toMatch(/disponibilidad/i);
    expect(result.reply).not.toMatch(/hola|soy Lina/i);
  });

  test("sin session.step (conversación nueva), un mensaje suelto no cae en la rama de completado", async () => {
    const result = await generateReply({
      analysis: { intent: "other" },
      session: {},
      semanticContext: "",
      userMessage: "Gracias",
    });

    expect(result.reply).toContain("¡Hasta pronto!");
  });

  test.each(["Chao", "Hasta luego", "Buenas noches", "Adiós, muchas gracias"])("se despide ante %s sin volver a saludar", async (userMessage) => {
    const result = await generateReply({ analysis: { intent: "greeting" }, session: {}, userMessage });
    expect(result.reply).toContain("¡Hasta pronto!");
    expect(result.reply).not.toMatch(/hola|soy Lina/i);
    expect(result.step).toBeNull();
  });
});
