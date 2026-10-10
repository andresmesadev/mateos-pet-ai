const { isConfirmationMessage, isPickupAddress, classifyManagementRequest } = require("../../services/assistant-protocol.service");

describe("Explicit booking authorization", () => {
  test.each(["No confirmo", "No estoy de acuerdo", "Necesito saber cuánto cuesta", "No sé si puedo", "Sí, pero para Matías", "Prefiero otra hora", "Sin recogida"])("does not confirm: %s", text => {
    expect(isConfirmationMessage(text)).toBe(false);
  });
  test.each(["Sí, confirmo", "Si", "Sí, acepto las 11:00", "Sí, confirmo la cita para Akiles el lunes a las 12:00", "Ok", "De acuerdo"])("confirms explicit acceptance: %s", text => {
    expect(isConfirmationMessage(text)).toBe(true);
  });
  test.each(["No sé todavía", "No tengo dirección", "Quiero otro día", "¿Qué dirección?", "Luego te digo"])("does not record non-address: %s", text => expect(isPickupAddress(text)).toBe(false));
  test.each(["Calle 12 # 34-56", "Finca El Sol, vereda La Paz"])("accepts address: %s", text => expect(isPickupAddress(text)).toBe(true));
  test.each(["¿Para hoy ya no hay?", "No tienes para hoy cita de peluquería", "Pero es de Akiles no de Matías", "Si pero esta es para peluquería"])("keeps booking despite an AI query classification: %s", text => {
    expect(classifyManagementRequest(text, "query_appointments", { requested_service: "bath_grooming" })).toBeNull();
  });
  test("new booking is not an appointments query", () => expect(classifyManagementRequest("Quiero agendar mi cita", "query_appointments")).toBeNull());
  test("explicit appointments query can interrupt a draft", () => expect(classifyManagementRequest("¿Cuándo es mi cita de Akiles?", "other", { requested_service: "bath_grooming" })).toBe("query_appointments"));
});
