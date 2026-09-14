jest.mock("../../lib/prisma", () => ({
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const {
  findUserByPhone,
  createUser,
  findOrCreateUser,
  updateUserNameIfMissing,
} = require("../user.service");

beforeEach(() => jest.clearAllMocks());

describe("findUserByPhone", () => {
  test("rechaza sin phone", async () => {
    await expect(findUserByPhone("")).rejects.toThrow("Phone is required");
  });

  test("con tenantId, busca por la clave compuesta tenantId_phone", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1" });
    await expect(findUserByPhone("  +573000000000  ", "tenant-1")).resolves.toEqual({ id: "u1" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_phone: { tenantId: "tenant-1", phone: "+573000000000" } },
    });
  });

  test("sin tenantId, busca entre los usuarios sin tenant asignado", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1" });
    await expect(findUserByPhone("+573000000000")).resolves.toEqual({ id: "u1" });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { phone: "+573000000000", tenantId: null },
    });
  });

  test("propaga el error de prisma", async () => {
    prisma.user.findFirst.mockRejectedValue(new Error("db down"));
    await expect(findUserByPhone("+573000000000")).rejects.toThrow("db down");
  });
});

describe("createUser", () => {
  test("rechaza sin phone", async () => {
    await expect(createUser("")).rejects.toThrow("Phone is required");
  });

  test("crea el usuario sin tenantId si no se provee", async () => {
    prisma.user.create.mockResolvedValue({ id: "u1" });
    await createUser("  +573000000000  ");
    expect(prisma.user.create).toHaveBeenCalledWith({ data: { phone: "+573000000000" } });
  });

  test("crea el usuario con tenantId cuando se provee", async () => {
    prisma.user.create.mockResolvedValue({ id: "u1" });
    await createUser("+573000000000", "tenant-1");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { phone: "+573000000000", tenantId: "tenant-1" },
    });
  });

  test("propaga el error de prisma", async () => {
    prisma.user.create.mockRejectedValue(new Error("db down"));
    await expect(createUser("+573000000000")).rejects.toThrow("db down");
  });
});

describe("findOrCreateUser", () => {
  test("retorna el usuario existente sin crear uno nuevo", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1" });
    await expect(findOrCreateUser("+573000000000")).resolves.toEqual({ id: "u1" });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test("crea el usuario si no existe", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u2" });
    await expect(findOrCreateUser("+573000000000")).resolves.toEqual({ id: "u2" });
  });

  test("propaga el error si falta phone", async () => {
    await expect(findOrCreateUser("")).rejects.toThrow("Phone is required");
  });

  test("propaga el error de prisma", async () => {
    prisma.user.findFirst.mockRejectedValue(new Error("db down"));
    await expect(findOrCreateUser("+573000000000")).rejects.toThrow("db down");
  });
});

describe("updateUserNameIfMissing", () => {
  test("retorna null sin tocar prisma si falta userId o name", async () => {
    await expect(updateUserNameIfMissing("", "Juan")).resolves.toBeNull();
    await expect(updateUserNameIfMissing("u1", "")).resolves.toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("retorna null si el usuario no existe", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(updateUserNameIfMissing("u1", "Juan")).resolves.toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("retorna null sin sobrescribir si el usuario ya tiene name", async () => {
    prisma.user.findUnique.mockResolvedValue({ name: "Existente" });
    await expect(updateUserNameIfMissing("u1", "Juan")).resolves.toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("guarda el name si el usuario no lo tenía", async () => {
    prisma.user.findUnique.mockResolvedValue({ name: null });
    prisma.user.update.mockResolvedValue({ id: "u1", name: "Juan" });
    await expect(updateUserNameIfMissing("u1", "  Juan  ")).resolves.toEqual({
      id: "u1",
      name: "Juan",
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Juan" },
    });
  });

  test("retorna null (sin lanzar) si prisma falla", async () => {
    prisma.user.findUnique.mockRejectedValue(new Error("db down"));
    await expect(updateUserNameIfMissing("u1", "Juan")).resolves.toBeNull();
  });
});
