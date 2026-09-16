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
    // Saneamiento: tenantId se deriva del dueño (mismo criterio aplicado a
    // Conversation en conversation-persistence.service.js) — antes quedaba
    // null, invisible para /api/dashboard/pets aunque sí contaba en
    // User._count.pets (sin filtro de tenant) en la tabla de clientes.
    const ownerUser = await prisma.user.findUnique({
      where: { id: owner },
      select: { tenantId: true },
    });

    const pet = await prisma.pet.create({
      data: {
        name: petName,
        type: petType,
        ownerId: owner,
        tenantId: ownerUser?.tenantId ?? null,
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

const updatePet = async (id, { name, breed, gender, birthDate, weight, sterilized, notes }) => {
  return prisma.pet.update({
    where: { id },
    data: {
      name: name ? String(name).trim() : undefined,
      breed: breed ?? undefined,
      gender: gender ?? undefined,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      weight: weight != null ? Number(weight) : undefined,
      sterilized: sterilized ?? undefined,
      notes: notes ?? undefined,
    },
  });
};

/**
 * Resuelve el nombre de mascota a guardar en una cita cuando la sesión de
 * WhatsApp no capturó un nombre explícito (queda genérico "Mascota"): si el
 * cliente ya tiene exactamente una mascota registrada, se usa su nombre real
 * en vez del genérico. No adivina si tiene varias (ambigüedad real), ni
 * cambia el flujo conversacional — solo mejora el dato guardado en la cita.
 */
const resolveAppointmentPetName = async (explicitName, ownerId) => {
  const trimmed = normalizeName(explicitName);

  if (trimmed) {
    return trimmed;
  }

  try {
    const pets = await getUserPets(ownerId);
    if (pets.length === 1) {
      return pets[0].name;
    }
  } catch (error) {
    console.error("[PetService] resolveAppointmentPetName error:", error.message);
  }

  return "Mascota";
};

module.exports = {
  findPetByNameAndOwner,
  createPet,
  findOrCreatePet,
  getUserPets,
  updatePet,
  resolveAppointmentPetName,
};
