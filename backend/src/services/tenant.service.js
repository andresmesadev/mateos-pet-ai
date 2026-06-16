const prisma = require("../lib/prisma");

const normalizeName = (v) => String(v || "").trim();
const normalizeSlug = (v) => String(v || "").trim().toLowerCase();
const normalizePhone = (v) => String(v || "").trim();

const createTenant = async (name, slug, phone) => {
  const tenantName = normalizeName(name);
  const tenantSlug = normalizeSlug(slug);
  const tenantPhone = normalizePhone(phone);

  if (!tenantName) throw new Error("name is required");
  if (!tenantSlug) throw new Error("slug is required");
  if (!tenantPhone) throw new Error("phone is required");

  try {
    const tenant = await prisma.tenant.create({
      data: { name: tenantName, slug: tenantSlug, phone: tenantPhone },
    });
    console.log("[TenantService] Tenant created:", tenant.id);
    return tenant;
  } catch (error) {
    console.error("[TenantService] createTenant error:", error.message);
    throw error;
  }
};

const getTenantByPhone = async (phone) => {
  const normalized = normalizePhone(phone);

  if (!normalized) throw new Error("phone is required");

  try {
    return await prisma.tenant.findUnique({ where: { phone: normalized } });
  } catch (error) {
    console.error("[TenantService] getTenantByPhone error:", error.message);
    throw error;
  }
};

const getTenantById = async (id) => {
  const tenantId = String(id || "").trim();

  if (!tenantId) throw new Error("id is required");

  try {
    return await prisma.tenant.findUnique({ where: { id: tenantId } });
  } catch (error) {
    console.error("[TenantService] getTenantById error:", error.message);
    throw error;
  }
};

const listTenants = async () => {
  try {
    return await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        email: true,
        plan: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            pets: true,
            appointments: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("[TenantService] listTenants error:", error.message);
    throw error;
  }
};

module.exports = {
  createTenant,
  getTenantByPhone,
  getTenantById,
  listTenants,
};
