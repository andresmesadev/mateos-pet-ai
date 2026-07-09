/**
 * Entregable 4.3 (Fase 4) — Configuración por Establecimiento (Alcance A):
 * fuente real de módulos activos y tasa de split de comisión por tenant.
 */
jest.mock("../../lib/prisma", () => ({
  tenant: { findUnique: jest.fn(), update: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const {
  DEFAULT_ACTIVE_MODULES,
  DEFAULT_COMMISSION_SPLIT_RATE,
  getActiveModules,
  getCommissionSplitRate,
  updateActiveModules,
  updateCommissionSplitRate,
} = require("../business-config.service");

beforeEach(() => jest.clearAllMocks());

describe("getActiveModules", () => {
  test("retorna los módulos por defecto sin tenantId", async () => {
    await expect(getActiveModules(null)).resolves.toEqual(DEFAULT_ACTIVE_MODULES);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  test("retorna los módulos reales del tenant", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["veterinary"] });
    await expect(getActiveModules("tenant-1")).resolves.toEqual(["veterinary"]);
  });

  test("retorna el default si el tenant no tiene módulos configurados (array vacío)", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ activeModules: [] });
    await expect(getActiveModules("tenant-1")).resolves.toEqual(DEFAULT_ACTIVE_MODULES);
  });
});

describe("getCommissionSplitRate", () => {
  test("retorna el default sin tenantId", async () => {
    await expect(getCommissionSplitRate(null, "cat-1")).resolves.toBe(DEFAULT_COMMISSION_SPLIT_RATE);
  });

  test("retorna la tasa real del tenant, ignorando categoryId", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ commissionSplitRate: { toString: () => "0.4" } });
    await expect(getCommissionSplitRate("tenant-1", "cat-1")).resolves.toBe(0.4);
  });
});

describe("updateActiveModules", () => {
  test("rechaza sin tenantId", async () => {
    await expect(updateActiveModules(null, ["grooming"])).rejects.toThrow("tenantId");
  });

  test("rechaza un valor que no sea array de strings no vacías", async () => {
    await expect(updateActiveModules("tenant-1", ["grooming", ""])).rejects.toThrow();
    await expect(updateActiveModules("tenant-1", "grooming")).rejects.toThrow();
  });

  test("actualiza los módulos activos del tenant", async () => {
    prisma.tenant.update.mockResolvedValue({ id: "tenant-1", activeModules: ["grooming"] });
    await updateActiveModules("tenant-1", ["grooming"]);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { activeModules: ["grooming"] },
      select: { id: true, activeModules: true },
    });
  });
});

describe("updateCommissionSplitRate", () => {
  test("rechaza tasas fuera de [0,1]", async () => {
    await expect(updateCommissionSplitRate("tenant-1", 1.5)).rejects.toThrow();
    await expect(updateCommissionSplitRate("tenant-1", -0.1)).rejects.toThrow();
    await expect(updateCommissionSplitRate("tenant-1", "no-numero")).rejects.toThrow();
  });

  test("actualiza la tasa de split del tenant", async () => {
    prisma.tenant.update.mockResolvedValue({ id: "tenant-1", commissionSplitRate: 0.4 });
    await updateCommissionSplitRate("tenant-1", 0.4);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { commissionSplitRate: 0.4 },
      select: { id: true, commissionSplitRate: true },
    });
  });
});
