const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const {
  listServices,
  createService,
  updateService,
  deleteService,
} = require("../../services/service.service");

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

    // Validate name
    if (!name || typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ error: "name es requerido y debe tener entre 1 y 100 caracteres" });
    }
    // Validate category
    const validCategories = ["veterinary", "grooming", "other"];
    if (!category || !validCategories.includes(String(category))) {
      return res.status(400).json({ error: "category debe ser veterinary, grooming u other" });
    }
    // Validate duration
    const durationNum = Number(duration);
    if (!duration || !Number.isInteger(durationNum) || durationNum <= 0) {
      return res.status(400).json({ error: "duration debe ser un entero positivo" });
    }

    // Check for duplicate name in same tenant
    const existing = await prisma.service.findFirst({
      where: { name: name.trim(), tenantId: tenantId ?? null },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: "Ya existe un servicio con ese nombre en este tenant" });
    }

    const service = await createService(tenantId ?? null, {
      name: name.trim(),
      category: String(category).trim(),
      duration: durationNum,
      requiresAppointment: requiresAppointment !== false,
      basePrice: basePrice !== undefined && basePrice !== null ? Number(basePrice) : null,
    });
    res.status(201).json(service);
  } catch (error) {
    console.error("[Dashboard] Create service error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, isSuperAdmin } = req.tenant;
    const { name, category, duration, requiresAppointment, active, basePrice } = req.body ?? {};

    // Verify ownership (unless super admin with no tenant filter)
    if (!isSuperAdmin || tenantId) {
      const owned = await prisma.service.findFirst({
        where: { id, tenantId: tenantId ?? null },
        select: { id: true },
      });
      if (!owned) {
        return res.status(404).json({ error: "Service not found" });
      }
    }

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (category !== undefined) data.category = String(category).trim();
    if (duration !== undefined) data.duration = Number(duration);
    if (requiresAppointment !== undefined) data.requiresAppointment = Boolean(requiresAppointment);
    if (active !== undefined) data.active = Boolean(active);
    if (basePrice !== undefined) data.basePrice = basePrice !== null ? Number(basePrice) : null;
    const updated = await updateService(id, data);
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update service error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Service not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, isSuperAdmin } = req.tenant;

    // Verify ownership (unless super admin with no tenant filter)
    if (!isSuperAdmin || tenantId) {
      const owned = await prisma.service.findFirst({
        where: { id, tenantId: tenantId ?? null },
        select: { id: true },
      });
      if (!owned) {
        return res.status(404).json({ error: "Service not found" });
      }
    }

    await deleteService(id);
    res.status(204).end();
  } catch (error) {
    console.error("[Dashboard] Delete service error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Service not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
