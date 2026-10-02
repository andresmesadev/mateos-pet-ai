const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { APPOINTMENT_INCLUDE, mapAppointmentRow, getBogotaYmd, bogotaDayStart } = require("./shared");

const GROOMING_FILTER = { OR: [
  { service: { is: { category: { is: { name: "grooming" } } } } },
  { serviceId: null, serviceType: { in: ["grooming", "bath_grooming", "bath", "baño", "peluquer", "corte", "spa", "deslanado", "colorimetría", "colorimetria", "antipulgas"] } },
] };

const mapVisit = (row) => ({
  ...mapAppointmentRow(row),
  groomingNotes: row.groomingNotes ?? null,
  groomingNotesVersion: row.groomingNotesVersion,
  groomingNotesUpdatedAt: row.groomingNotesUpdatedAt ?? null,
  groomingDeliveredAt: row.groomingDeliveredAt ?? null,
});

function mapForViewer(row, req) {
  const mapped = mapVisit(row);
  return req.access && !req.access.capabilities.cash && !req.access.capabilities.appointmentPrice
    ? { ...mapped, hasResolvedPrice: mapped.finalPrice != null, finalPrice: null, priceResolution: null }
    : mapped;
}

router.use("/grooming", async (req, res, next) => {
  try {
    const tenantId = req.tenant.tenantId;
    if (!tenantId) return res.status(400).json({ error: "Selecciona un establecimiento." });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { activeModules: true } });
    if (!(req.actor?.type === "admin" && req.method === "GET") && !tenant?.activeModules.includes("grooming")) return res.status(403).json({ error: "El módulo de peluquería no está activo." });
    next();
  } catch (error) {
    console.error("[Grooming] Module lookup failed:", error.message);
    res.status(500).json({ error: "No se pudo comprobar el módulo de peluquería." });
  }
});

router.get("/grooming/appointments", async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search.length > 80) return res.status(400).json({ error: "Busca con un máximo de 80 caracteres." });
    const date = req.query.date ?? getBogotaYmd();
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(bogotaDayStart(date).getTime()) || bogotaDayStart(date).toISOString().slice(0, 10) !== date) {
      return res.status(400).json({ error: "Selecciona una fecha válida." });
    }
    const start = bogotaDayStart(date);
    const conditions = [GROOMING_FILTER];
    if (search.length >= 2) conditions.push({ OR: [
      { petName: { contains: search, mode: "insensitive" } },
      { pet: { is: { name: { contains: search, mode: "insensitive" } } } },
      { user: { is: { name: { contains: search, mode: "insensitive" } } } },
    ] });
    else conditions.push({ date: { gte: start, lt: new Date(start.getTime() + 86400000) } });
    const rows = await prisma.appointment.findMany({
      where: { tenantId: req.tenant.tenantId, AND: conditions },
      include: APPOINTMENT_INCLUDE,
      orderBy: search.length >= 2 ? [{ date: "desc" }, { id: "desc" }] : [{ date: "asc" }, { id: "asc" }],
      take: 101,
    });
    res.json({ appointments: rows.slice(0, 100).map(row => mapForViewer(row, req)), hasMore: rows.length > 100 });
  } catch (error) {
    console.error("[Grooming] List failed:", error.message);
    res.status(500).json({ error: "No se pudieron cargar las citas de peluquería." });
  }
});

router.get("/grooming/pets/:petId/notes", async (req, res) => {
  try {
    const { petId } = req.params;
    const tenantId = req.tenant.tenantId;
    const pet = await prisma.pet.findFirst({ where: { id: petId, tenantId }, select: { id: true } });
    if (!pet) return res.status(404).json({ error: "Mascota no encontrada." });
    const conditions = [GROOMING_FILTER, { groomingNotes: { not: null } }];
    if (typeof req.query.exclude === "string") conditions.push({ id: { not: req.query.exclude } });
    if (req.query.cursor) {
      if (typeof req.query.cursor !== "string") return res.status(400).json({ error: "Página inválida." });
      const cursor = await prisma.appointment.findFirst({ where: { id: req.query.cursor, petId, tenantId, AND: [GROOMING_FILTER] }, select: { id: true, date: true } });
      if (!cursor) return res.status(404).json({ error: "Actualiza las notas para continuar." });
      conditions.push({ OR: [{ date: { lt: cursor.date } }, { date: cursor.date, id: { lt: cursor.id } }] });
    }
    const rows = await prisma.appointment.findMany({ where: { petId, tenantId, AND: conditions }, include: APPOINTMENT_INCLUDE, orderBy: [{ date: "desc" }, { id: "desc" }], take: 21 });
    const visits = rows.slice(0, 20);
    res.json({ visits: visits.map(row => {
      return mapForViewer(row, req);
    }), nextCursor: rows.length > 20 ? visits.at(-1).id : null });
  } catch (error) {
    console.error("[Grooming] Notes history failed:", error.message);
    res.status(500).json({ error: "No se pudieron cargar las notas anteriores." });
  }
});

router.put("/grooming/appointments/:id/notes", async (req, res) => {
  try {
    const { notes, expectedVersion } = req.body ?? {};
    if (typeof notes !== "string" || notes.length > 6000 || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return res.status(400).json({ error: "La nota admite hasta 6000 caracteres y necesita la versión vigente." });
    }
    const where = { id: req.params.id, tenantId: req.tenant.tenantId, AND: [GROOMING_FILTER] };
    const existing = await prisma.appointment.findFirst({ where, include: APPOINTMENT_INCLUDE });
    if (!existing) return res.status(404).json({ error: "Cita de peluquería no encontrada." });
    if (req.actor?.type === "groomer" && existing.staffId !== req.actor.staffId) return res.status(403).json({ error: "Inicia la atención con tu usuario antes de modificarla." });
    if (!existing.petId || ["cancelled", "no_show"].includes(existing.status)) return res.status(422).json({ error: "La cita necesita una mascota y no puede estar cancelada o no asistida." });
    if (existing.groomingNotesVersion !== expectedVersion) return res.status(409).json({ error: "Otra persona modificó la nota. Actualiza la cita antes de guardar." });
    const cleanNotes = notes.trim() || null;
    if (existing.groomingNotes === cleanNotes) return res.json(mapForViewer(existing, req));
    const saved = await prisma.appointment.updateMany({ where: { ...where, ...(req.actor?.type === "groomer" ? { staffId: req.actor.staffId } : {}), groomingNotesVersion: expectedVersion, status: { notIn: ["cancelled", "no_show"] } }, data: { groomingNotes: cleanNotes, groomingNotesVersion: { increment: 1 }, groomingNotesUpdatedAt: new Date() } });
    if (saved.count !== 1) return res.status(409).json({ error: "La cita o la nota cambió. Actualiza antes de guardar." });
    res.json(mapForViewer(await prisma.appointment.findFirst({ where, include: APPOINTMENT_INCLUDE }), req));
  } catch (error) {
    console.error("[Grooming] Save notes failed:", error.message);
    res.status(500).json({ error: "No se pudieron guardar las notas de la atención." });
  }
});

router.post("/grooming/appointments/:id/delivery", async (req, res) => {
  try {
    const where = { id: req.params.id, tenantId: req.tenant.tenantId, AND: [GROOMING_FILTER] };
    const existing = await prisma.appointment.findFirst({ where, include: APPOINTMENT_INCLUDE });
    if (!existing) return res.status(404).json({ error: "Cita de peluquería no encontrada." });
    if (req.actor?.type === "groomer" && existing.staffId !== req.actor.staffId) return res.status(403).json({ error: "Inicia la atención con tu usuario antes de modificarla." });
    if (existing.status !== "completed") return res.status(422).json({ error: "Termina el servicio antes de registrar la entrega." });
    if (existing.groomingDeliveredAt) return res.json(mapForViewer(existing, req));
    await prisma.appointment.updateMany({ where: { ...where, ...(req.actor?.type === "groomer" ? { staffId: req.actor.staffId } : {}), status: "completed", groomingDeliveredAt: null }, data: { groomingDeliveredAt: new Date() } });
    const updated = await prisma.appointment.findFirst({ where, include: APPOINTMENT_INCLUDE });
    if (!updated?.groomingDeliveredAt) return res.status(409).json({ error: "La cita cambió. Actualiza la lista." });
    res.json(mapForViewer(updated, req));
  } catch (error) {
    console.error("[Grooming] Delivery failed:", error.message);
    res.status(500).json({ error: "No se pudo registrar la entrega." });
  }
});

module.exports = router;
