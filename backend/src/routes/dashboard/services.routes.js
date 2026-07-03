const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
// Entregable Puente: este adaptador delega en los casos de uso del contexto
// Servicios (2.1) y absorbe la traducción category (nombre) ↔ categoryId que
// vivía en service.service.js, sin cambiar el contrato hacia el frontend.
const { createService, updateService, deactivateService, changeServicePrice } = require("../../contexts/services");
const {
  InvalidServiceAttributesError,
  DuplicateServiceNameError,
  ServiceCategoryNotEnabledError,
  ServiceNotFoundError,
  InvalidPriceError,
} = require("../../contexts/services/domain/errors");

const VALID_CATEGORIES = ["veterinary", "grooming", "other"];
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

function mapServiceDomainError(res, error) {
  if (error instanceof InvalidServiceAttributesError || error instanceof InvalidPriceError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ServiceCategoryNotEnabledError) return res.status(400).json({ error: error.message });
  if (error instanceof ServiceNotFoundError) return res.status(404).json({ error: "Service not found" });
  if (error instanceof DuplicateServiceNameError) {
    return res.status(409).json({ error: "Ya existe un servicio con ese nombre en este tenant" });
  }
  return null;
}

async function mapServiceRow(service) {
  const category = await prisma.serviceCategory.findUnique({
    where: { id: service.categoryId },
    select: { name: true },
  });
  return { ...service, category: category?.name ?? null };
}

router.get("/services", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const rows = await prisma.service.findMany({
      where: tenantId ? { tenantId } : {},
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
    res.json(rows.map(({ category, ...row }) => ({ ...row, category: category?.name ?? null })));
  } catch (error) {
    console.error("[Dashboard] Services error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/services", async (req, res) => {
  try {
    const { name, category, duration, requiresAppointment, basePrice } = req.body ?? {};
    const { tenantId } = req.tenant;

    if (!name || typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ error: "name es requerido y debe tener entre 1 y 100 caracteres" });
    }
    if (!category || !VALID_CATEGORIES.includes(String(category))) {
      return res.status(400).json({ error: "category debe ser veterinary, grooming u other" });
    }
    const durationNum = Number(duration);
    if (!duration || !Number.isInteger(durationNum) || durationNum <= 0) {
      return res.status(400).json({ error: "duration debe ser un entero positivo" });
    }

    // Contrato legacy: unicidad de nombre por tenant (el caso de uso valida
    // además por categoría) — se preserva el 409 histórico.
    const existing = await prisma.service.findFirst({
      where: { name: name.trim(), tenantId: tenantId ?? null },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: "Ya existe un servicio con ese nombre en este tenant" });
    }

    const categoryId = await resolveCategoryId(tenantId ?? null, String(category).trim());

    const { service } = await createService({
      tenantId: tenantId ?? null,
      name: name.trim(),
      categoryId,
      duration: durationNum,
      // Regla de dominio 2.1: el precio base no puede ser nulo. El contrato
      // legacy permitía omitirlo; se conserva la permisividad materializándolo
      // como 0 (precio resuelto válido — ADR 007-D4), nunca como indeterminado.
      basePrice: basePrice !== undefined && basePrice !== null ? Number(basePrice) : 0,
    });

    // requiresAppointment es un atributo de presentación/agenda de Fase 1,
    // fuera del contrato del caso de uso de 2.1 — passthrough del adaptador.
    let row = service;
    if (requiresAppointment === false) {
      row = await prisma.service.update({ where: { id: service.id }, data: { requiresAppointment: false } });
    }

    res.status(201).json(await mapServiceRow(row));
  } catch (error) {
    if (mapServiceDomainError(res, error)) return;
    console.error("[Dashboard] Create service error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, isSuperAdmin } = req.tenant;
    const { name, category, duration, requiresAppointment, active, basePrice } = req.body ?? {};

    if (!isSuperAdmin || tenantId) {
      const owned = await prisma.service.findFirst({
        where: { id, tenantId: tenantId ?? null },
        select: { id: true },
      });
      if (!owned) {
        return res.status(404).json({ error: "Service not found" });
      }
    }

    // Atributos del dominio (2.1): nombre, categoría, duración.
    if (name !== undefined || category !== undefined || duration !== undefined) {
      const categoryId =
        category !== undefined ? await resolveCategoryId(tenantId ?? null, String(category).trim()) : undefined;
      await updateService({
        tenantId: tenantId ?? null,
        serviceId: id,
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(duration !== undefined ? { duration: Number(duration) } : {}),
      });
    }

    // Precio base — único lugar: ChangeServicePriceUseCase (target base).
    if (basePrice !== undefined) {
      await changeServicePrice({ serviceId: id, target: null, newPrice: basePrice !== null ? Number(basePrice) : 0 });
    }

    // Desactivación por caso de uso; la reactivación no tiene caso de uso en
    // 2.1 (deuda registrada en la Validación del Puente) — passthrough.
    if (active === false) {
      await deactivateService({ serviceId: id });
    } else if (active === true) {
      await prisma.service.update({ where: { id }, data: { active: true } });
    }

    if (requiresAppointment !== undefined) {
      await prisma.service.update({ where: { id }, data: { requiresAppointment: Boolean(requiresAppointment) } });
    }

    const updated = await prisma.service.findUnique({ where: { id } });
    res.json(await mapServiceRow(updated));
  } catch (error) {
    if (mapServiceDomainError(res, error)) return;
    console.error("[Dashboard] Update service error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Service not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, isSuperAdmin } = req.tenant;

    if (!isSuperAdmin || tenantId) {
      const owned = await prisma.service.findFirst({
        where: { id, tenantId: tenantId ?? null },
        select: { id: true },
      });
      if (!owned) {
        return res.status(404).json({ error: "Service not found" });
      }
    }

    // Regla de dominio 2.1: el catálogo no borra — desactiva (mismo 204 hacia fuera).
    await deactivateService({ serviceId: id });
    res.status(204).end();
  } catch (error) {
    if (mapServiceDomainError(res, error)) return;
    console.error("[Dashboard] Delete service error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Service not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
