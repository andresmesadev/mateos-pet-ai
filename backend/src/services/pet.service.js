const prisma = require("../lib/prisma");

const normalizeName = (name) => String(name || "").trim();

const normalizeType = (type) => String(type || "").trim().toLowerCase();

const findPetByNameAndOwner = async (name, ownerId) => {
  const petName = normalizeName(name);
  const owner = String(ownerId || "").trim();

  if (!petName || !owner) {
    throw new Error("Pet name and ownerId are required");
  }

  try {
    return await prisma.pet.findFirst({
      where: {
        ownerId: owner,
        name: {
          equals: petName,
          mode: "insensitive",
        },
      },
    });
  } catch (error) {
    console.error("[PetService] findPetByNameAndOwner error:", error.message);
    throw error;
  }
};

const createPet = async ({ name, type, ownerId }) => {
  const petName = normalizeName(name);
  const petType = normalizeType(type);
  const owner = String(ownerId || "").trim();

  if (!petName || !petType || !owner) {
    throw new Error("Pet name, type and ownerId are required");
  }

  try {
    const pet = await prisma.pet.create({
      data: {
        name: petName,
        type: petType,
        ownerId: owner,
      },
    });
    console.log("[PetService] Pet created");
    return pet;
  } catch (error) {
    console.error("[PetService] createPet error:", error.message);
    throw error;
  }
};

const findOrCreatePet = async ({ name, type, ownerId }) => {
  try {
    const existing = await findPetByNameAndOwner(name, ownerId);

    if (existing) {
      console.log("[PetService] Pet found");
      return existing;
    }

    return await createPet({ name, type, ownerId });
  } catch (error) {
    console.error("[PetService] findOrCreatePet error:", error.message);
    throw error;
  }
};

const getUserPets = async (ownerId) => {
  const owner = String(ownerId || "").trim();

  if (!owner) {
    throw new Error("ownerId is required");
  }

  try {
    return await prisma.pet.findMany({
      where: { ownerId: owner },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[PetService] getUserPets error:", error.message);
    throw error;
  }
};

module.exports = {
  findPetByNameAndOwner,
  createPet,
  findOrCreatePet,
  getUserPets,
};
