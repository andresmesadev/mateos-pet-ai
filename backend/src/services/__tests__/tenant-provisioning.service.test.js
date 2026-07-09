/**
 * Entregable 4.2 (Fase 4) — Onboarding Autónomo: aprovisionamiento de
 * Empleados Digitales base para un tenant recién registrado.
 */
jest.mock("../../contexts/agents", () => ({
  getDigitalEmployees: jest.fn(),
  registerDigitalEmployee: jest.fn(),
}));

const agents = require("../../contexts/agents");
const {
  DEFAULT_SPECIALIZATIONS,
  provisionDefaultDigitalEmployees,
} = require("../tenant-provisioning.service");

const TENANT_ID = "tenant-1";

beforeEach(() => jest.clearAllMocks());

describe("provisionDefaultDigitalEmployees", () => {
  test("registra cada especialización por defecto cuando no existe ninguna", async () => {
    agents.getDigitalEmployees.mockResolvedValue({ digitalEmployees: [] });
    agents.registerDigitalEmployee.mockImplementation(async ({ specialization }) => ({
      digitalEmployee: { id: `de-${specialization}`, specialization, status: "activo" },
    }));

    const { results } = await provisionDefaultDigitalEmployees(TENANT_ID);

    expect(results).toHaveLength(DEFAULT_SPECIALIZATIONS.length);
    expect(results.every((r) => r.created)).toBe(true);
    expect(agents.registerDigitalEmployee).toHaveBeenCalledTimes(DEFAULT_SPECIALIZATIONS.length);
    for (const specialization of DEFAULT_SPECIALIZATIONS) {
      expect(agents.registerDigitalEmployee).toHaveBeenCalledWith({ tenantId: TENANT_ID, specialization });
    }
  });

  test("es idempotente: no duplica si ya existe una especialización", async () => {
    agents.getDigitalEmployees.mockResolvedValue({
      digitalEmployees: [{ id: "existing-1", specialization: DEFAULT_SPECIALIZATIONS[0], status: "activo" }],
    });

    const { results } = await provisionDefaultDigitalEmployees(TENANT_ID);

    const first = results.find((r) => r.specialization === DEFAULT_SPECIALIZATIONS[0]);
    expect(first.created).toBe(false);
    expect(first.digitalEmployeeId).toBe("existing-1");
    expect(agents.registerDigitalEmployee).not.toHaveBeenCalledWith(
      expect.objectContaining({ specialization: DEFAULT_SPECIALIZATIONS[0] })
    );
  });

  test("el fallo de una especialización no impide aprovisionar las demás", async () => {
    agents.getDigitalEmployees.mockResolvedValue({ digitalEmployees: [] });
    agents.registerDigitalEmployee
      .mockRejectedValueOnce(new Error("fallo inesperado"))
      .mockResolvedValueOnce({ digitalEmployee: { id: "de-2", specialization: DEFAULT_SPECIALIZATIONS[1] } });

    const { results } = await provisionDefaultDigitalEmployees(TENANT_ID);

    expect(results).toHaveLength(DEFAULT_SPECIALIZATIONS.length);
    expect(results[0].error).toBe("fallo inesperado");
    expect(results[1].created).toBe(true);
  });
});
