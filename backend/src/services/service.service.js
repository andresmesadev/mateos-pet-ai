const prisma = require("../lib/prisma");

/**
 * Compatibilidad: este módulo es el adaptador legacy de Fase 1 para el
 * dashboard. Desde el Entregable 2.1, Service.category (String) fue
 * reemplazado por Service.categoryId (relación a ServiceCategory) —
 * ver docs/architecture/technical-design/servicios-esquema-fisico.md.
 *
 * El contrato externo de este módulo (recibir/devolver "category" como
 * texto plano) se mantiene sin cambios para no romper al frontend del
 * dashboard, que todavía no fue migrado a invocar los casos de uso del
 * contexto contexts/services. Esta capa traduce category (nombre) ↔
 * categoryId puertas adentro.
 */

const SPLIT_BY_DEFAULT = Object.freeze({ grooming: true, veterinary: false, other: false });

async function resolveCategoryId(tenantId, categoryName) {
  const existing = await prisma.serviceCategory.findFirst({
    where: { tenantId: tenantId ?? null, name: categoryName },
  });
  if (existing) return existing.id;

  const created = await prisma.serviceCategory.create({
    data: {
      tenantId: tenantId ?? null,
      name: categoryName,
      appliesCommissionSplit: SPLIT_BY_DEFAULT[categoryName] ?? false,
      active: true,
    },
  });
  return created.id;
}

function withCategoryName(service) {
  if (!service) return service;
  const { category, ...rest } = service;
  return { ...rest, category: category?.name ?? null };
}

const listServices = async (tenantId) => {
  const rows = await prisma.service.findMany({
    where: { tenantId, active: true },
    include: { category: { select: { name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map(withCategoryName);
};

const getService = async (id) => {
  const service = await prisma.service.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
  return withCategoryName(service);
};

const createService = async (tenantId, data) => {
  const { category, ...rest } = data;
  const categoryId = await resolveCategoryId(tenantId, category);
  const service = await prisma.service.create({
    data: { ...rest, categoryId, tenantId },
    include: { category: { select: { name: true } } },
  });
  return withCategoryName(service);
};

const updateService = async (id, data) => {
  const { category, ...rest } = data;
  const updateData = { ...rest };
  if (category !== undefined) {
    const current = await prisma.service.findUnique({ where: { id }, select: { tenantId: true } });
    updateData.categoryId = await resolveCategoryId(current?.tenantId ?? null, category);
  }
  const service = await prisma.service.update({
    where: { id },
    data: updateData,
    include: { category: { select: { name: true } } },
  });
  return withCategoryName(service);
};

const deleteService = async (id) => {
  const service = await prisma.service.update({
    where: { id },
    data: { active: false },
    include: { category: { select: { name: true } } },
  });
  return withCategoryName(service);
};

module.exports = { listServices, getService, createService, updateService, deleteService };
