const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const {
  updateActiveModules,
  updateCommissionSplitRate,
} = require("../../services/business-config.service");

function resolveTenantId(req) {
  const { tenantId, isSuperAdmin } = req.tenant;
  return tenantId || (isSuperAdmin ? process.env.SINGLE_TENANT_ID : null) || null;
}

// Entregable 6.2 (Fase 6) — Agenda Multi-Establecimiento: `businessHours`
// pasa de ser decorativo a vincular la reserva real (`availability.service.js`).
// Se endurece su validación en el único punto de entrada (esta ruta) para que
// una configuración malformada nunca llegue a persistirse — el motor de
// disponibilidad ya trata cualquier entrada inválida como "sin configurar"
// (comportamiento legado), pero es mejor rechazarla aquí que dejarla
// silenciosamente inerte.
const BUSINESS_HOURS_DAY_KEYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const HH_MM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateBusinessHours(businessHours) {
  if (typeof businessHours !== "object" || businessHours === null || Array.isArray(businessHours)) {
    return "businessHours debe ser un objeto";
  }
  for (const [day, entry] of Object.entries(businessHours)) {
    if (!BUSINESS_HOURS_DAY_KEYS.has(day)) {
      return `Día no reconocido en businessHours: "${day}"`;
    }
    if (typeof entry !== "object" || entry === null) {
      return `La configuración de "${day}" debe ser un objeto`;
    }
    if (typeof entry.active !== "boolean") {
      return `"${day}.active" debe ser booleano`;
    }
    if (entry.active) {
      if (typeof entry.open !== "string" || !HH_MM_PATTERN.test(entry.open)) {
        return `"${day}.open" debe tener formato HH:mm`;
      }
      if (typeof entry.close !== "string" || !HH_MM_PATTERN.test(entry.close)) {
        return `"${day}.close" debe tener formato HH:mm`;
      }
      if (entry.open >= entry.close) {
        return "La hora de apertura debe ser anterior a la hora de cierre";
      }
    }
  }
  return null;
}

router.get("/tenant/profile", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, name: true, slug: true, phone: true, email: true,
        description: true, address: true, logoUrl: true, businessHours: true,
        plan: true, active: true, createdAt: true,
        activeModules: true, commissionSplitRate: true,
      },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    res.json(tenant);
  } catch (error) {
    console.error("[Dashboard] Tenant profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tenant/profile", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });

    const { name, email, description, address, logoUrl, businessHours } = req.body ?? {};

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (email !== undefined) data.email = email?.trim() || null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (logoUrl !== undefined) data.logoUrl = logoUrl?.trim() || null;
    if (businessHours !== undefined) {
      const validationError = validateBusinessHours(businessHours);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
      data.businessHours = businessHours;
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true, name: true, slug: true, phone: true, email: true,
        description: true, address: true, logoUrl: true, businessHours: true,
        plan: true, active: true,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update tenant profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Entregable 4.3 (Fase 4) — Configuración por Establecimiento (Alcance A):
 * módulos activos y tasa de split de comisión. Endpoint separado del perfil
 * (tenant/profile) para reutilizar la validación ya centralizada en
 * business-config.service.js sin duplicarla aquí.
 */
router.put("/tenant/config", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });

    const { activeModules, commissionSplitRate } = req.body ?? {};

    if (activeModules !== undefined) {
      await updateActiveModules(tenantId, activeModules);
    }
    if (commissionSplitRate !== undefined) {
      await updateCommissionSplitRate(tenantId, commissionSplitRate);
    }

    const updated = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, activeModules: true, commissionSplitRate: true },
    });
    res.json(updated);
  } catch (error) {
    console.error("[Dashboard] Update tenant config error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const where = tenantId ? { tenantId } : {};

    const [users, pets, appointments, conversations] = await Promise.all([
      prisma.user.count({ where }),
      prisma.pet.count({ where }),
      prisma.appointment.count({ where }),
      prisma.conversation.count({ where }),
    ]);

    res.json({ users, pets, appointments, conversations });
  } catch (error) {
    console.error("[Dashboard] Stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
