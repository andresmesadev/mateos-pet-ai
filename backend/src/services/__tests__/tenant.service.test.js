jest.mock("../../lib/prisma", () => ({
  tenant: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const {
  createTenant,
  getTenantByPhone,
  getTenantById,
  listActiveTenants,
} = require("../tenant.service");

beforeEach(() => jest.clearAllMocks());

describe("createTenant", () => {
  test("rechaza sin name", async () => {
    await expect(createTenant("", "slug", "+573000000000")).rejects.toThrow("name is required");
  });

  test("rechaza sin slug", async () => {
    await expect(createTenant("Nombre", "", "+573000000000")).rejects.toThrow("slug is required");
  });

  test("rechaza sin phone", async () => {
    await expect(createTenant("Nombre", "slug", "")).rejects.toThrow("phone is required");
  });

  test("crea el tenant con slug normalizado a minúsculas", async () => {
    prisma.tenant.create.mockResolvedValue({ id: "tenant-1" });
    await createTenant("Nombre", "SLUG", "+573000000000");
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: "Nombre", slug: "slug", phone: "+573000000000" },
    });
  });
});

describe("getTenantByPhone", () => {
  test("rechaza sin phone", async () => {
    await expect(getTenantByPhone("")).rejects.toThrow("phone is required");
  });

  test("busca el tenant por phone", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1" });
    await expect(getTenantByPhone("+573000000000")).resolves.toEqual({ id: "tenant-1" });
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { phone: "+573000000000" } });
  });
});

describe("getTenantById", () => {
  test("rechaza sin id", async () => {
    await expect(getTenantById("")).rejects.toThrow("id is required");
  });

  test("busca el tenant por id", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1" });
    await expect(getTenantById("tenant-1")).resolves.toEqual({ id: "tenant-1" });
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: "tenant-1" } });
  });
});

describe("listActiveTenants", () => {
  test("lista solo los tenants activos", async () => {
    prisma.tenant.findMany.mockResolvedValue([{ id: "tenant-1", active: true }]);
    await expect(listActiveTenants()).resolves.toEqual([{ id: "tenant-1", active: true }]);
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({ where: { active: true } });
  });
});
