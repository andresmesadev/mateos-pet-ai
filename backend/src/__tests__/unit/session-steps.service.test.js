/**
 * Entregable 8.3 (Fase 8) — D-E1: vocabulario cerrado de session.step.
 */
const { STEPS } = require("../../services/conversation.service");
const { isValidStep, assertValidStep } = require("../../services/session-steps.service");

describe("isValidStep", () => {
  test("null y undefined son válidos (sin paso activo)", () => {
    expect(isValidStep(null)).toBe(true);
    expect(isValidStep(undefined)).toBe(true);
  });

  test("todo valor de STEPS es válido", () => {
    for (const step of Object.values(STEPS)) {
      expect(isValidStep(step)).toBe(true);
    }
  });

  test("un string fuera del enum no es válido", () => {
    expect(isValidStep("paso_inventado")).toBe(false);
    expect(isValidStep("human_takeover_typo")).toBe(false);
  });
});

describe("assertValidStep", () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test("paso válido: no registra nada", () => {
    assertValidStep(STEPS.AWAITING_PET_NAME, { phone: "+573000000000" });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("paso inválido: registra el error, no lanza", () => {
    expect(() => assertValidStep("paso_inventado", { phone: "+573000000000" })).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("vocabulario cerrado");
  });
});
