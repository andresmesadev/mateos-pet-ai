const prisma = require("../lib/prisma");

const normalizePhone = (phone) => String(phone || "").trim();

/**
 * Entregable 4.1 (Fase 4) — M1: `phone` dejó de ser único globalmente
 * (@@unique([tenantId, phone])) — dos tenants distintos pueden tener cada
 * uno un usuario con el mismo número. Con tenantId se busca por la clave
 * compuesta; sin tenantId (compatibilidad hacia atrás) se busca entre los
 * usuarios sin tenant asignado.
 */
const findUserByPhone = async (phone, tenantId = null) => {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    throw new Error("Phone is required");
  }

  try {
    if (tenantId) {
      return await prisma.user.findUnique({
        where: { tenantId_phone: { tenantId, phone: normalized } },
      });
    }
    return await prisma.user.findFirst({
      where: { phone: normalized, tenantId: null },
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
    const existing = await findUserByPhone(phone, tenantId);

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

/**
 * Guarda el nombre del cliente solo si aún no lo tenía (no sobrescribe uno
 * ya capturado por el dashboard o una conversación anterior). No-op segura
 * si el userId no existe.
 */
const updateUserNameIfMissing = async (userId, name) => {
  const id = String(userId || "").trim();
  const trimmedName = String(name || "").trim();

  if (!id || !trimmedName) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
    if (!user || user.name) {
      return null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name: trimmedName },
    });
    console.log("[UserService] Client name captured");
    return updated;
  } catch (error) {
    console.error("[UserService] updateUserNameIfMissing error:", error.message);
    return null;
  }
};

module.exports = {
  findUserByPhone,
  createUser,
  findOrCreateUser,
  updateUserNameIfMissing,
};
