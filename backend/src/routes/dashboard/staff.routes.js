const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { staffEditorError } = require("../../services/staff-editor-validation.service");
const { withStaffLock, assignmentReason, saveWeeklySchedule, changeAvailability, staffReview, correctAbsence, readServiceScope, saveServiceScope } = require('../../services/staff-scheduling.service');
const { buildAppointmentDateTime } = require('../../services/appointment.service');
const { normalizeEmail, validPassword, hashPassword } = require("../../services/staff-credential.service");
// Entregable Puente: este adaptador delega en los casos de uso del contexto
// Staff (2.2) — el roster deja de gestionarse vía staff.service.js legacy.
const {
  registerStaff,
  updateStaff,
  deactivateStaff,
  reactivateStaff,
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

function staffEditorRow(row) {
  const { availabilities, ...member } = row;
  const base = availabilities?.filter(a => a.type === 'base_schedule') ?? [];
  if (!base.length) return member;
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  member.availability = {};
  for (const window of base) {
    const key = days[window.weekday], prior = member.availability[key];
    const windows = [...(prior?.windows ?? []), {open:window.startTime,close:window.endTime}].sort((a,b)=>a.open.localeCompare(b.open));
    member.availability[key] = { active:true, open:windows[0].open, close:windows[windows.length-1].close, windows };
  }
  return member;
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
      include: { credential: { select: { email: true, active: true } }, availabilities: { where: { type: 'base_schedule' } } },
    });
    res.json(rows.map(staffEditorRow));
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

    const invalid = staffEditorError(req.body ?? {});
    if (invalid) return res.status(400).json({ error: invalid });

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
    const { date, time, serviceId, appointmentId, serviceType } = req.query;

    if (!date || !time) return res.status(400).json({ error: "date y time son requeridos" });

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
        Number.isNaN(new Date(`${date}T12:00:00Z`).getTime()) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) return res.status(400).json({ error: 'Fecha y hora no válidas.' });
    const service = serviceId ? await prisma.service.findFirst({ where: { id: String(serviceId), tenantId }, include: { category: true } }) : null;
    if (serviceId && !service) return res.status(404).json({ error: 'Servicio no encontrado.' });

    const allStaff = await prisma.staff.findMany({
      where: { ...(tenantId ? { tenantId } : {}), active: true },
      select: { id: true, name: true, role: true, availability: true },
    });

    const at = buildAppointmentDateTime(date, Number(time.slice(0, 2)) + Number(time.slice(3)) / 60);
    const available = [];
    for (const staff of allStaff) {
      if (!await assignmentReason(prisma, { staffId: staff.id, tenantId, date: at, service, serviceType, appointmentId: appointmentId ? String(appointmentId) : undefined })) available.push(staff);
    }

    res.json(available.map((s) => ({ id: s.id, name: s.name, role: s.role })));
  } catch (error) {
    console.error("[Dashboard] Staff available error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/staff/:id/availability-review', async (req, res) => {
  try { res.json(await staffReview(req.params.id, req.tenant.tenantId)); }
  catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'No se pudo cargar la disponibilidad.' }); }
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

    // Validar todo antes del primer comando para no guardar parcialmente
    // atributos cuando el mismo envío contiene un horario inválido.
    const invalid = staffEditorError(req.body ?? {});
    if (invalid) return res.status(400).json({ error: invalid });

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role debe ser uno de: ${VALID_ROLES.join(", ")}` });
    }

    // Atributos del roster — caso de uso Actualizar Staff (2.2).
    if (name !== undefined || role !== undefined || phone !== undefined || email !== undefined) {
      await withStaffLock(id, () => updateStaff({
        staffId: id,
        tenantId,
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
      }));
    }

    // Activación/desactivación — casos de uso propios (2.2).
    if (active === false && existing.active) {
      await withStaffLock(id, () => deactivateStaff({ staffId: id, tenantId }));
    } else if (active === true && !existing.active) {
      await withStaffLock(id, () => reactivateStaff({ staffId: id, tenantId }));
    }

    // ADR 011: semana + franjas estructuradas sincronizadas, ausencias conservadas.
    if (availability !== undefined) {
      await saveWeeklySchedule(id, tenantId, availability);
    }

    const updated = await prisma.staff.findUnique({ where: { id }, include: { availabilities: { where: { type: 'base_schedule' } } } });
    res.json(staffEditorRow(updated));
  } catch (error) {
    if (error.code === 'STAFF_UNAVAILABLE') return res.status(error.status).json({ error: error.message });
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
    await withStaffLock(id, () => deactivateStaff({ staffId: id, tenantId }));
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
    const { availability } = await changeAvailability(req.params.id, tenantId, { type, schedule, range });
    res.json({ availability });
  } catch (error) {
    if (error.code === 'STAFF_UNAVAILABLE') return res.status(error.status).json({ error: error.message });
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Update availability error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /staff/:id/absences — body: { startAt, endAt, reason }
router.post("/staff/:id/absences", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { startAt, endAt, reason, type = 'unplanned_absence' } = req.body ?? {};
    if (!['planned_absence', 'unplanned_absence'].includes(type) || (reason != null && (typeof reason !== 'string' || reason.length > 1000))) return res.status(400).json({ error: 'Tipo o motivo de ausencia no válido.' });
    const { availability } = await changeAvailability(req.params.id, tenantId, { type, range: { startAt, endAt, reason } });
    res.status(201).json({ availability });
  } catch (error) {
    if (error.code === 'STAFF_UNAVAILABLE') return res.status(error.status).json({ error: error.message });
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
    const result = await saveServiceScope(req.params.id, tenantId, { scope:'selected', serviceIds });
    res.json(result);
  } catch (error) {
    if (error.code === 'STAFF_UNAVAILABLE') return res.status(error.status).json({ error: error.message });
    if (mapStaffDomainError(res, error)) return;
    console.error("[Dashboard] Manage capabilities error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post('/staff/:id/absences/:absenceId/change', async (req,res) => {
  try {
    const { action,changeReason,range } = req.body ?? {};
    const result=await correctAbsence(req.params.id,req.tenant.tenantId,{absenceId:req.params.absenceId,action,changeReason,range,author:req.actor?.name || req.actor?.email || 'Administrador'});
    return res.json(result);
  } catch(error) {
    if (error.code === 'ABSENCE_NOT_FOUND') return res.status(404).json({error:error.message});
    if (error.code === 'ABSENCE_CONFLICT') return res.status(409).json({error:error.message});
    if (mapStaffDomainError(res,error)) return;
    return res.status(500).json({error:'No se pudo guardar la corrección de la ausencia.'});
  }
});
router.get('/staff/:id/services', async(req,res)=>{
  try { return res.json(await readServiceScope(req.params.id,req.tenant.tenantId)); }
  catch(error) { return res.status(error.status || 503).json({error:error.status ? error.message : 'No se pudieron consultar los servicios del integrante.'}); }
});
router.put('/staff/:id/services',async(req,res)=>{
  try { const {scope,serviceIds}=req.body ?? {};return res.json(await saveServiceScope(req.params.id,req.tenant.tenantId,{scope,serviceIds})); }
  catch(error) {
    if(error.code==='STAFF_UNAVAILABLE')return res.status(error.status).json({error:error.message});
    if(mapStaffDomainError(res,error))return;
    return res.status(503).json({error:'No se pudieron guardar los servicios del integrante.'});
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
