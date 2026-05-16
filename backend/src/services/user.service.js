const prisma = require("../lib/prisma");

const normalizePhone = (phone) => String(phone || "").trim();

const findUserByPhone = async (phone) => {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    throw new Error("Phone is required");
  }

  try {
    return await prisma.user.findUnique({
      where: { phone: normalized },
    });
  } catch (error) {
    console.error("[UserService] findUserByPhone error:", error.message);
    throw error;
  }
};

const createUser = async (phone) => {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    throw new Error("Phone is required");
  }

  try {
    const user = await prisma.user.create({
      data: { phone: normalized },
    });
    console.log("[UserService] User created");
    return user;
  } catch (error) {
    console.error("[UserService] createUser error:", error.message);
    throw error;
  }
};

const findOrCreateUser = async (phone) => {
  try {
    const existing = await findUserByPhone(phone);

    if (existing) {
      console.log("[UserService] User found");
      return existing;
    }

    return await createUser(phone);
  } catch (error) {
    console.error("[UserService] findOrCreateUser error:", error.message);
    throw error;
  }
};

module.exports = {
  findUserByPhone,
  createUser,
  findOrCreateUser,
};
