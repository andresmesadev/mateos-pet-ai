const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { normalizeEmail, validPassword, hashPassword } = require("../../services/staff-credential.service");
// Entregable Puente: este adaptador delega en los casos de uso del contexto
// Staff (2.2) — el roster deja de gestionarse vía staff.service.js legacy.
const {
  registerStaff,
  updateStaff,
  deactivateStaff,
  reactivateStaff,
  updateAvailability,
  manageStaffCapabilities,
  recordUnplannedAbsence,
  generateSettlement,
  listSettlements,
  voidCommission,
} = require("../../contexts/staff");
const {
  InvalidStaffAttributesError,
  InvalidAvailabilityRangeError,
  ReferencedServiceNotFoundError,
  DuplicateStaffCapabilityError,
  StaffNotFoundError,
  StaffAlreadyInactiveError,
  StaffAlreadyActiveError,
  NoCommissionsForPeriodError,
  SettlementAlreadyExistsError,
  InvalidCommissionInputError,
  CommissionNotFoundError,
  CommissionAlreadyVoidedError,
  CommissionDayClosedError,
  CommissionInActiveSettlementError,
} = require("../../contexts/staff/domain/errors");

const { EXTRA_PERMISSIONS } = require("../../services/dashboard-access.service");

const VALID_ROLES = ["vet", "groomer", "receptionist", "admin"];

function mapStaffDomainError(res, error) {
  if (
    error instanceof InvalidStaffAttributesError ||
    error instanceof InvalidCommissionInputError ||
    error instanceof InvalidAvailabilityRangeError
  ) {
    return res.status(400).json({ error: error.message });
  }
  if (
    error instanceof StaffNotFoundError ||
    error instanceof CommissionNotFoundError ||
    error instanceof ReferencedServiceNotFoundError
  ) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof DuplicateStaffCapabilityError ||
    error instanceof StaffAlreadyInactiveError ||
    error instanceof StaffAlreadyActiveError ||
    error instanceof SettlementAlreadyExistsError ||
    error instanceof CommissionAlreadyVoidedError ||
    error instanceof CommissionDayClosedError ||
    error instanceof CommissionInActiveSettlementError
  ) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof NoCommissionsForPeriodError) {
    return res.status(422).json({ error: error.message });
  }
  return null;
}

router.get("/staff", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    if (req.actor?.type && req.actor.type !== "admin") {
      const clinicians = await prisma.staff.findMany({
        where: { tenantId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true, active: true },
      });
      return res.json(clinicians);
    }
    const rows = await prisma.staff.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { credential: { select: { email: true, active: true } } },
    });
    res.json(rows);
  } catch (error) {
    console.error("[Dashboard] Staff error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// La cuenta identifica al autor de la historia. Solo el administrador puede
// provisionar, restablecer o revocar este acceso.
router.patch("/staff/:id/access", async (req, res) => {
  const permissions = req.body?.accessPermissions;
  if (!Array.isArray(permissions) || permissions.some(p => !EXTRA_PERMISSIONS.includes(p))) {
    return res.status(400).json({ error: "Permisos inválidos" });
  }
  try {
    const staff = await prisma.staff.findFirst({ where: { id: req.params.id, tenantId: req.tenant.tenantId } });
    if (!staff) return res.status(404).json({ error: "Miembro no encontrado" });
    const updated = await prisma.staff.update({ where: { id: staff.id }, data: { accessPermissions: [...new Set(permissions)] } });
    return res.json({ id: updated.id, accessPermissions: updated.accessPermissions });
  } catch (error) {
    console.error("[Access] Staff permissions:", error);
    return res.status(500).json({ error: "No se pudieron guardar los permisos" });
  }
});

router.put("/staff/:id/credential", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const staff = await prisma.staff.findFirst({
      where: tenantId ? { id: req.params.id, tenantId } : { id: req.params.id },
      select: { id: true, role: true, active: true, email: true },
    });
    if (!staff) return res.status(404).json({ error: "Profesional no encontrado" });
    if (!VALID_ROLES.includes(staff.role) || !staff.active) return res.status(422).json({ error: "Solo un miembro activo del equipo puede tener acceso" });
    const email = normalizeEmail(req.body?.email ?? staff.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Escribe un correo válido para el profesional" });
    }
    if (req.actor?.email && email === req.actor.email) {
      return res.status(422).json({ error: "Tu cuenta de administrador ya permite atender consultas. Vincula este correo a tu ficha de veterinario sin crear otra contraseña." });
    }
    if (!validPassword(req.body?.password)) {
      return res.status(400).json({ error: "La contraseña debe tener entre 12 y 128 caracteres" });
    }
    const passwordHash = await hashPassword(req.body.password);
    const credential = await prisma.staffCredential.upsert({
      where: { staffId: staff.id },
      create: { staffId: staff.id, email, passwordHash },
      update: { email, passwordHash, active: true, sessionVersion: { increment: 1 } },
      select: { email: true, active: true },
    });
    return res.json(credential);
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Ese correo ya tiene una cuenta" });
    console.error("[Dashboard] Staff credential error:", error);
    return res.status(500).json({ error: "No se pudo guardar el acceso" });
  }
});

router.delete("/staff/:id/credential", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const staff = await prisma.staff.findFirst({
      where: tenantId ? { id: req.params.id, tenantId } : { id: req.params.id },
      select: { id: true },
    });
    if (!staff) return res.status(404).json({ error: "Profesional no encontrado" });
    await prisma.staffCredential.updateMany({ where: { staffId: staff.id }, data: { active: false } });
    return res.status(204).end();
  } catch (error) {
    console.error("[Dashboard] Revoke staff credential error:", error);
    return res.status(500).json({ error: "No se pudo revocar el acceso" });
  }
});

router.post("/staff", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, role, phone, email } = req.body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name es requerido" });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
    }

    const { staff } = await registerStaff({
      tenantId: tenantId ?? null,
      name: name.trim(),
      role,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
    });
    res.status(201).json(staff);
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Create staff error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// IMPORTANT: GET /staff/available must be registered BEFORE PATCH /staff/:id and DELETE /staff/:id
router.get("/staff/available", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { date, time } = req.query;

    if (!date || !time) return res.status(400).json({ error: "date y time son requeridos" });

    const DOW_MAP = ["sun","mon","tue","wed","thu","fri","sat"];
    const dayKey = DOW_MAP[new Date(`${date}T12:00:00Z`).getUTCDay()];

    const allStaff = await prisma.staff.findMany({
      where: { ...(tenantId ? { tenantId } : {}), active: true },
      select: { id: true, name: true, role: true, availability: true },
    });

    const available = allStaff.filter((s) => {
      if (!s.availability) return true; // no restrictions = always available
      const day = s.availability[dayKey];
      if (!day || !day.active) return false;
      return time >= day.open && time < day.close;
    });

    res.json(available.map((s) => ({ id: s.id, name: s.name, role: s.role })));
  } catch (error) {
    console.error("[Dashboard] Staff available error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const { name, role, phone, email, active, availability } = req.body ?? {};

    const existing = await prisma.staff.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true, active: true },
    });
    if (!existing) return res.status(404).json({ error: "Staff not found" });

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
    }

    // Atributos del roster — caso de uso Actualizar Staff (2.2).
    if (name !== undefined || role !== undefined || phone !== undefined || email !== undefined) {
      await updateStaff({
        staffId: id,
        tenantId,
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
      });
    }

    // Activación/desactivación — casos de uso propios (2.2).
    if (active === false && existing.active) {
      await deactivateStaff({ staffId: id, tenantId });
    } else if (active === true && !existing.active) {
      await reactivateStaff({ staffId: id, tenantId });
    }

    // Disponibilidad semanal JSON: campo legado de Fase 1 (ADR 003 — convive
    // sin sincronización con StaffAvailability). Passthrough del adaptador.
    if (availability !== undefined) {
      await prisma.staff.update({ where: { id }, data: { availability } });
    }

    const updated = await prisma.staff.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Update staff error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Staff not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const existing = await prisma.staff.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Staff not found" });

    // Regla de dominio 2.2: el roster no borra — desactiva (mismo 204 hacia fuera).
    await deactivateStaff({ staffId: id, tenantId });
    res.status(204).end();
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Delete staff error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Staff not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Disponibilidad, ausencias y capacidades (2.2) — Entregable Puente ────────

// PUT /staff/:id/availability — body: { type, schedule?, range? }
router.put("/staff/:id/availability", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { type, schedule, range } = req.body ?? {};
    const { availability } = await updateAvailability({ staffId: req.params.id, type, schedule, range, tenantId });
    res.json({ availability });
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Update availability error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /staff/:id/absences — body: { startAt, endAt, reason }
router.post("/staff/:id/absences", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { startAt, endAt, reason } = req.body ?? {};
    const { availability } = await recordUnplannedAbsence({ staffId: req.params.id, startAt, endAt, reason, tenantId });
    res.status(201).json({ availability });
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Record absence error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /staff/:id/capabilities — body: { serviceIds: string[] }
router.put("/staff/:id/capabilities", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { serviceIds } = req.body ?? {};
    const result = await manageStaffCapabilities({ staffId: req.params.id, serviceIds, tenantId });
    res.json(result);
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Manage capabilities error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Liquidaciones (2.2) — expuestas por el Entregable Puente ─────────────────

// POST /settlements — Generar Liquidación de Período
router.post("/settlements", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { staffId, periodStart, periodEnd } = req.body ?? {};
    if (!staffId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: "staffId, periodStart y periodEnd son requeridos" });
    }

    const { settlement } = await generateSettlement({ tenantId: tenantId ?? null, staffId, periodStart, periodEnd });
    res.status(201).json(settlement);
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Generate settlement error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /settlements?staffId=&from=&to=
router.get("/settlements", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { staffId, from, to } = req.query;

    const { settlements } = await listSettlements({
      tenantId: tenantId ?? null,
      staffId: staffId ?? null,
      periodStart: from ?? null,
      periodEnd: to ?? null,
    });
    res.json(settlements);
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] List settlements error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Comisiones — ADR 009: anulación con reemplazo, comando único atómico ─────

// POST /commissions/:id/void — body: { reason, replacement?: { resolvedPrice, staffId? } }
router.post("/commissions/:id/void", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { reason, replacement } = req.body ?? {};

    const result = await voidCommission({
      tenantId: tenantId ?? null,
      commissionId: req.params.id,
      reason,
      replacement: replacement ?? null,
    });

    res.json({ voided: result.voided, replacement: result.replacement });
  } catch (error) {
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Void commission error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
