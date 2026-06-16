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

const createUser = async (phone, tenantId = null) => {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    throw new Error("Phone is required");
  }

  try {
    const data = { phone: normalized };
    if (tenantId) data.tenantId = tenantId;

    const user = await prisma.user.create({ data });
    console.log("[UserService] User created");
    return user;
  } catch (error) {
    console.error("[UserService] createUser error:", error.message);
    throw error;
  }
};

const findOrCreateUser = async (phone, tenantId = null) => {
  try {
    const existing = await findUserByPhone(phone);

    if (existing) {
      console.log("[UserService] User found");
      return existing;
    }

    return await createUser(phone, tenantId);
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
