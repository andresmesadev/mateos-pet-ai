/**
 * Selección explícita: una mascota registrada no impide que el cliente
 * traiga otra. El historial propone nombres, pero no elige por el cliente.
 */

jest.mock("../../services/pet.service", () => ({
  getUserPets: jest.fn(),
  findPetByNameAndOwner: jest.fn(),
}));

const { getUserPets } = require("../../services/pet.service");
const { generateReply, STEPS } = require("../../services/conversation.service");

describe("generateReply — selección de mascota en cada reserva", () => {
  test("con una sola mascota registrada, pregunta y permite seleccionar otra", async () => {
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

    expect(result.sessionPatch.pet_name).toBeUndefined();
    expect(result.step).toBe(STEPS.AWAITING_PET_NAME);
    expect(result.reply).toContain("Benji patricio");
    expect(result.reply).toContain("otra mascota");
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
    expect(result.reply).toContain("Benji");
    expect(result.reply).toContain("Michi");
  });
});
