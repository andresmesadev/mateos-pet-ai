/**
 * Entregable 4.3 (Fase 4) — verifica que el reader de Servicios delega en
 * business-config.service.js, sin devolver ya el valor hardcodeado.
 */
jest.mock("../../../services/business-config.service", () => ({
  getActiveModules: jest.fn(),
}));

const businessConfig = require("../../../services/business-config.service");
const { PrismaBusinessConfigReader } = require("../infrastructure/persistence/prisma-business-config.reader");

test("getActiveModules delega en business-config.service con el tenantId recibido", async () => {
  businessConfig.getActiveModules.mockResolvedValue(["veterinary"]);
  const reader = new PrismaBusinessConfigReader();

  await expect(reader.getActiveModules("tenant-1")).resolves.toEqual(["veterinary"]);
  expect(businessConfig.getActiveModules).toHaveBeenCalledWith("tenant-1");
});
