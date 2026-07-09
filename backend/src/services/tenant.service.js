const prisma = require("../lib/prisma");

const createTenant = async (name, slug, phone) => {
  name = String(name || "").trim();
  slug = String(slug || "").trim().toLowerCase();
  phone = String(phone || "").trim();
  if (!name) throw new Error("name is required");
  if (!slug) throw new Error("slug is required");
  if (!phone) throw new Error("phone is required");
  return prisma.tenant.create({ data: { name, slug, phone } });
};

const getTenantByPhone = async (phone) => {
  phone = String(phone || "").trim();
  if (!phone) throw new Error("phone is required");
  return prisma.tenant.findUnique({ where: { phone } });
};

const getTenantById = async (id) => {
  id = String(id || "").trim();
  if (!id) throw new Error("id is required");
  return prisma.tenant.findUnique({ where: { id } });
};

/**
 * Entregable 4.1 (Fase 4) — M4: soporta la iteración por tenant de procesos
 * batch (recordatorios) que antes corrían sin distinción de tenant.
 */
const listActiveTenants = async () => {
  return prisma.tenant.findMany({ where: { active: true } });
};

module.exports = { createTenant, getTenantByPhone, getTenantById, listActiveTenants };
