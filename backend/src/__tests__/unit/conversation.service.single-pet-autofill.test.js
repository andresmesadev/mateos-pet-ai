/**
 * Corrección del hallazgo "Mascota genérica": cuando el cliente tiene
 * exactamente una mascota registrada, el atajo de autocompletado (evita
 * preguntar "¿cómo se llama tu mascota?") calculaba la respuesta con el
 * nombre correcto, pero nunca lo escribía en sessionPatch — la sesión
 * persistida se quedaba sin pet_name/pet_type, y la cita terminaba
 * creándose con el valor por defecto "Mascota" sin vincular a la mascota
 * real. Reproduce el escenario exacto: un solo pet conocido, el usuario no
 * repite su nombre, se pide una cita de veterinaria.
 */
jest.mock("../../services/domain/medical-auto-capture.service", () => ({
  trySaveMedicalInfo: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../services/pet.service", () => ({
  getUserPets: jest.fn(),
  findPetByNameAndOwner: jest.fn(),
}));

const { getUserPets } = require("../../services/pet.service");
const { generateReply, STEPS } = require("../../services/conversation.service");

describe("generateReply — autocompletado de mascota única", () => {
  test("con exactamente una mascota registrada, pet_name/pet_type quedan en sessionPatch", async () => {
    getUserPets.mockResolvedValue([{ id: "pet-1", name: "Benji patricio", type: "dog" }]);

    const result = await generateReply(
      {
        analysis: { intent: "schedule_appointment", requested_service: "veterinary_consultation" },
        session: {},
        semanticContext: "",
        userMessage: "Para una cita de veterinaria",
      },
      { userId: "user-1" }
    );

    expect(result.sessionPatch.pet_name).toBe("Benji patricio");
    expect(result.sessionPatch.pet_type).toBe("dog");
    expect(result.step).toBe(STEPS.AWAITING_DATE_TIME);
  });

  test("con más de una mascota, sigue preguntando cuál — sin autocompletar", async () => {
    getUserPets.mockResolvedValue([
      { id: "pet-1", name: "Benji", type: "dog" },
      { id: "pet-2", name: "Michi", type: "cat" },
    ]);

    const result = await generateReply(
      {
        analysis: { intent: "schedule_appointment", requested_service: "veterinary_consultation" },
        session: {},
        semanticContext: "",
        userMessage: "Para una cita de veterinaria",
      },
      { userId: "user-1" }
    );

    expect(result.step).toBe(STEPS.AWAITING_PET_NAME);
    expect(result.sessionPatch.pet_name).toBeUndefined();
  });
});
