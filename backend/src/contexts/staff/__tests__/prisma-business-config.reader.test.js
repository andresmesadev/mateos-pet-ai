/**
 * Entregable 4.3 (Fase 4) — verifica que el reader de Staff delega en
 * business-config.service.js, sin devolver ya los valores hardcodeados.
 */
jest.mock("../../../services/business-config.service", () => ({
  getActiveModules: jest.fn(),
  getCommissionSplitRate: jest.fn(),
}));

const businessConfig = require("../../../services/business-config.service");
const { PrismaBusinessConfigReader } = require("../infrastructure/persistence/prisma-business-config.reader");

test("getActiveModules delega en business-config.service", async () => {
  businessConfig.getActiveModules.mockResolvedValue(["grooming"]);
  const reader = new PrismaBusinessConfigReader();

  await expect(reader.getActiveModules("tenant-1")).resolves.toEqual(["grooming"]);
  expect(businessConfig.getActiveModules).toHaveBeenCalledWith("tenant-1");
});

test("getCommissionSplitRate delega en business-config.service con tenantId y categoryId", async () => {
  businessConfig.getCommissionSplitRate.mockResolvedValue(0.4);
  const reader = new PrismaBusinessConfigReader();

  await expect(reader.getCommissionSplitRate("tenant-1", "cat-1")).resolves.toBe(0.4);
  expect(businessConfig.getCommissionSplitRate).toHaveBeenCalledWith("tenant-1", "cat-1");
});
