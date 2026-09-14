jest.mock("../../lib/prisma", () => ({
  pet: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  user: { findUnique: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const {
  findPetByNameAndOwner,
  createPet,
  findOrCreatePet,
  getUserPets,
  updatePet,
  resolveAppointmentPetName,
} = require("../pet.service");

beforeEach(() => jest.clearAllMocks());

describe("findPetByNameAndOwner", () => {
  test("rechaza sin name", async () => {
    await expect(findPetByNameAndOwner("", "owner-1")).rejects.toThrow(
      "Pet name and ownerId are required"
    );
  });

  test("rechaza sin ownerId", async () => {
    await expect(findPetByNameAndOwner("Firulais", "")).rejects.toThrow(
      "Pet name and ownerId are required"
    );
  });

  test("busca la mascota por nombre (case-insensitive) y dueño", async () => {
    prisma.pet.findFirst.mockResolvedValue({ id: "pet-1", name: "Firulais" });
    await expect(findPetByNameAndOwner("  Firulais  ", "owner-1")).resolves.toEqual({
      id: "pet-1",
      name: "Firulais",
    });
    expect(prisma.pet.findFirst).toHaveBeenCalledWith({
      where: { ownerId: "owner-1", name: { equals: "Firulais", mode: "insensitive" } },
    });
  });

  test("propaga el error de prisma", async () => {
    prisma.pet.findFirst.mockRejectedValue(new Error("db down"));
    await expect(findPetByNameAndOwner("Firulais", "owner-1")).rejects.toThrow("db down");
  });
});

describe("createPet", () => {
  test("rechaza sin name, type u ownerId", async () => {
    await expect(createPet({ name: "", type: "dog", ownerId: "owner-1" })).rejects.toThrow(
      "Pet name, type and ownerId are required"
    );
    await expect(createPet({ name: "Firulais", type: "", ownerId: "owner-1" })).rejects.toThrow();
    await expect(createPet({ name: "Firulais", type: "dog", ownerId: "" })).rejects.toThrow();
  });

  test("crea la mascota con el tenantId derivado del dueño", async () => {
    prisma.user.findUnique.mockResolvedValue({ tenantId: "tenant-1" });
    prisma.pet.create.mockResolvedValue({ id: "pet-1" });
    await createPet({ name: "  Firulais  ", type: "DOG", ownerId: "owner-1" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "owner-1" },
      select: { tenantId: true },
    });
    expect(prisma.pet.create).toHaveBeenCalledWith({
      data: { name: "Firulais", type: "dog", ownerId: "owner-1", tenantId: "tenant-1" },
    });
  });

  test("crea la mascota con tenantId null si el dueño no existe", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.pet.create.mockResolvedValue({ id: "pet-1" });
    await createPet({ name: "Firulais", type: "dog", ownerId: "owner-1" });
    expect(prisma.pet.create).toHaveBeenCalledWith({
      data: { name: "Firulais", type: "dog", ownerId: "owner-1", tenantId: null },
    });
  });

  test("propaga el error de prisma", async () => {
    prisma.user.findUnique.mockResolvedValue({ tenantId: "tenant-1" });
    prisma.pet.create.mockRejectedValue(new Error("db down"));
    await expect(
      createPet({ name: "Firulais", type: "dog", ownerId: "owner-1" })
    ).rejects.toThrow("db down");
  });
});

describe("findOrCreatePet", () => {
  test("retorna la mascota existente sin crear una nueva", async () => {
    prisma.pet.findFirst.mockResolvedValue({ id: "pet-1", name: "Firulais" });
    await expect(
      findOrCreatePet({ name: "Firulais", type: "dog", ownerId: "owner-1" })
    ).resolves.toEqual({ id: "pet-1", name: "Firulais" });
    expect(prisma.pet.create).not.toHaveBeenCalled();
  });

  test("crea la mascota si no existe", async () => {
    prisma.pet.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ tenantId: "tenant-1" });
    prisma.pet.create.mockResolvedValue({ id: "pet-2", name: "Firulais" });
    await expect(
      findOrCreatePet({ name: "Firulais", type: "dog", ownerId: "owner-1" })
    ).resolves.toEqual({ id: "pet-2", name: "Firulais" });
    expect(prisma.pet.create).toHaveBeenCalled();
  });

  test("propaga el error si falta name/ownerId", async () => {
    await expect(
      findOrCreatePet({ name: "", type: "dog", ownerId: "owner-1" })
    ).rejects.toThrow("Pet name and ownerId are required");
  });

  test("propaga el error de prisma", async () => {
    prisma.pet.findFirst.mockRejectedValue(new Error("db down"));
    await expect(
      findOrCreatePet({ name: "Firulais", type: "dog", ownerId: "owner-1" })
    ).rejects.toThrow("db down");
  });
});

describe("getUserPets", () => {
  test("rechaza sin ownerId", async () => {
    await expect(getUserPets("")).rejects.toThrow("ownerId is required");
  });

  test("retorna las mascotas del dueño ordenadas por creación", async () => {
    prisma.pet.findMany.mockResolvedValue([{ id: "pet-1" }]);
    await expect(getUserPets("owner-1")).resolves.toEqual([{ id: "pet-1" }]);
    expect(prisma.pet.findMany).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  test("propaga el error de prisma", async () => {
    prisma.pet.findMany.mockRejectedValue(new Error("db down"));
    await expect(getUserPets("owner-1")).rejects.toThrow("db down");
  });
});

describe("updatePet", () => {
  test("normaliza los campos presentes y deja undefined los ausentes", async () => {
    prisma.pet.update.mockResolvedValue({ id: "pet-1" });
    await updatePet("pet-1", { name: "  Firulais  ", weight: "12.5" });
    expect(prisma.pet.update).toHaveBeenCalledWith({
      where: { id: "pet-1" },
      data: {
        name: "Firulais",
        breed: undefined,
        gender: undefined,
        birthDate: undefined,
        weight: 12.5,
        sterilized: undefined,
        notes: undefined,
      },
    });
  });

  test("convierte birthDate a Date cuando se envía", async () => {
    prisma.pet.update.mockResolvedValue({ id: "pet-1" });
    await updatePet("pet-1", { birthDate: "2020-01-01" });
    const call = prisma.pet.update.mock.calls[0][0];
    expect(call.data.birthDate).toBeInstanceOf(Date);
  });
});

describe("resolveAppointmentPetName", () => {
  test("retorna el nombre explícito si se provee", async () => {
    await expect(resolveAppointmentPetName("  Firulais  ", "owner-1")).resolves.toBe("Firulais");
    expect(prisma.pet.findMany).not.toHaveBeenCalled();
  });

  test("usa el nombre de la única mascota del dueño si no hay nombre explícito", async () => {
    prisma.pet.findMany.mockResolvedValue([{ id: "pet-1", name: "Firulais" }]);
    await expect(resolveAppointmentPetName(null, "owner-1")).resolves.toBe("Firulais");
  });

  test("retorna 'Mascota' si el dueño tiene 0 o varias mascotas", async () => {
    prisma.pet.findMany.mockResolvedValue([]);
    await expect(resolveAppointmentPetName(null, "owner-1")).resolves.toBe("Mascota");

    prisma.pet.findMany.mockResolvedValue([{ name: "A" }, { name: "B" }]);
    await expect(resolveAppointmentPetName(null, "owner-1")).resolves.toBe("Mascota");
  });

  test("retorna 'Mascota' sin lanzar si getUserPets falla", async () => {
    prisma.pet.findMany.mockRejectedValue(new Error("db down"));
    await expect(resolveAppointmentPetName(null, "owner-1")).resolves.toBe("Mascota");
  });
});
