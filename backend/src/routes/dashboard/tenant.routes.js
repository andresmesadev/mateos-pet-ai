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

/**
 * Entregable 6.6 (Fase 6) — Operación Centralizada, Fase A: capacidad
 * administrativa de solo lectura, gateada exclusivamente por
 * `req.tenant.viewAllTenants` (mecanismo cerrado en la Fase B). Nunca
 * expone registros individuales — solo agregados por tenant, calculados
 * desde `Transaction`/`Expense` (nunca `DailyClose`, que depende de que
 * el tenant haya cerrado el día). `Commission`/payroll queda fuera de
 * alcance por decisión explícita del diseño congelado.
 */
router.get("/tenants/overview", async (req, res) => {
  try {
    if (!req.tenant.viewAllTenants) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const tenants = await prisma.tenant.findMany({
      where: { active: true },
      select: { id: true, name: true, plan: true, active: true },
    });
    const tenantIds = tenants.map((t) => t.id);

    const [userCounts, appointmentCounts, conversationCounts, revenueSums, expenseSums] =
      await Promise.all([
        prisma.user.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds } },
          _count: { _all: true },
        }),
        prisma.appointment.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds } },
          _count: { _all: true },
        }),
        prisma.conversation.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds } },
          _count: { _all: true },
        }),
        prisma.transaction.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds }, status: "active" },
          _sum: { total: true },
        }),
        prisma.expense.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds } },
          _sum: { amount: true },
        }),
      ]);

    const toMap = (rows) => new Map(rows.map((r) => [r.tenantId, r]));
    const usersMap = toMap(userCounts);
    const apptMap = toMap(appointmentCounts);
    const convMap = toMap(conversationCounts);
    const revenueMap = toMap(revenueSums);
    const expenseMap = toMap(expenseSums);

    const overview = tenants.map((t) => {
      const revenueTotal = Number(revenueMap.get(t.id)?._sum?.total ?? 0);
      const expenseTotal = Number(expenseMap.get(t.id)?._sum?.amount ?? 0);
      return {
        tenantId: t.id,
        name: t.name,
        plan: t.plan,
        active: t.active,
        usersCount: usersMap.get(t.id)?._count?._all ?? 0,
        appointmentsCount: apptMap.get(t.id)?._count?._all ?? 0,
        conversationsCount: convMap.get(t.id)?._count?._all ?? 0,
        revenueTotal,
        expenseTotal,
        netTotal: revenueTotal - expenseTotal,
      };
    });

    res.json({ tenants: overview, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Dashboard] Tenants overview error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Gestión Mínima de ApiKey (Revocación de Sesión y Gestión Mínima de
 * ApiKey). Solo lectura y revocación — la creación permanece fuera de
 * alcance (deuda documentada, sigue vía acceso directo a la base de datos).
 * keyHash nunca se incluye en la respuesta.
 *
 * GET /api/dashboard/api-keys
 */
router.get("/api-keys", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });

    const apiKeys = await prisma.apiKey.findMany({
      where: { tenantId },
      select: { id: true, scopes: true, createdAt: true, revokedAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ apiKeys });
  } catch (error) {
    console.error("[Dashboard] GET /api-keys error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/dashboard/api-keys/:id/revoke
 * Ownership obligatorio vía (id, tenantId) en una sola consulta. Idempotente:
 * revocar una key ya revocada responde 200 sin error, sin filtrar estado por
 * código de respuesta.
 */
router.post("/api-keys/:id/revoke", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });

    const { id } = req.params;
    const apiKey = await prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!apiKey) {
      return res.status(404).json({ error: "ApiKey no encontrada" });
    }

    const revoked = await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { revokedAt: apiKey.revokedAt ?? new Date() },
      select: { id: true, scopes: true, createdAt: true, revokedAt: true, lastUsedAt: true },
    });

    res.json({ apiKey: revoked });
  } catch (error) {
    console.error("[Dashboard] POST /api-keys/:id/revoke error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
