const router = require("express").Router();
const prisma = require("../../lib/prisma");
const { createHash } = require("node:crypto");
const { resolvePrice, isGroomingAppointment } = require("../../services/domain/price-resolver.service");
const { APPOINTMENT_INCLUDE, mapAppointmentRow, getBogotaYmd, bogotaDayStart } = require("./shared");
const { serviceModule, moduleAllowsAppointment } = require("../../services/dashboard-access.service");
const { readOperationalCash } = require("./operational-cash-page");
const { HistoryQueryError } = require("./financial-history-page");
router.get("/access", (req, res) => res.json(req.access));
router.get('/cash/professionals', async (req, res) => {
  if (!req.tenant.tenantId || !req.access?.capabilities.cash) return res.status(403).json({ error: 'Caja no está habilitada.' });
  try {
    const tenantId = req.tenant.tenantId, serviceId = req.query.serviceId;
    if (typeof serviceId !== 'string' || !serviceId) return res.status(400).json({ error: 'Selecciona el servicio.' });
    const service = await prisma.service.findFirst({ where: { id: serviceId, tenantId, active: true }, include: { category: true } });
    if (!service || !moduleAllowsAppointment(req.access, { service })) return res.status(404).json({ error: 'Servicio no disponible.' });
    const { compatibleRole, canProvideService } = require('../../contexts/staff/domain/rules/service-scope.rules');
    const rows = await prisma.staff.findMany({ where: { tenantId, active: true }, select: { id: true, name: true, role: true, serviceScope: true, capabilities: { where: { serviceId, active: true } } }, orderBy: { name: 'asc' } });
    res.json(rows.filter(person => compatibleRole(person, service.category.name) && canProvideService(person, person.capabilities, serviceId)).map(({ id, name, role }) => ({ id, name, role })));
  }
  catch { res.status(503).json({ error: 'No se pudo cargar el equipo.' }); }
});
router.get("/cash/context", (req, res) => {
  const actorId = req.actor?.staffId || req.actor?.email;
  if (!req.tenant.tenantId || !actorId) return res.status(403).json({ error: "No se pudo identificar el contexto de caja." });
  const scope = createHash("sha256").update(JSON.stringify([
    req.tenant.tenantId, req.actor.type, actorId, req.headers["x-staff-session-version"] || null,
  ])).digest("hex");
  return res.json({ draftScope: scope });
});
router.get("/cash/catalog", async (req, res) => {
  try {
    const tenantId = req.tenant.tenantId;
    if (!tenantId) return res.status(403).json({ error: "Selecciona un establecimiento." });
    const petId = req.query.petId;
    if (req.query.additional !== undefined && req.query.additional !== '1') return res.status(400).json({ error: 'Consulta de adicionales no válida.' });
    const additional = req.query.additional === '1';
    if (petId !== undefined && (typeof petId !== "string" || !petId)) return res.status(400).json({ error: "Mascota no válida." });
    const pet = petId ? await prisma.pet.findFirst({ where: { id: petId, tenantId }, select: { id: true, defaultGroomingPrice: true } }) : null;
    if (petId && !pet) return res.status(404).json({ error: "Mascota no encontrada en este establecimiento." });
    const services = await prisma.service.findMany({
      where: { tenantId, active: true },
      include: { category: { select: { name: true, appliesCommissionSplit: true } }, ...(pet ? { priceRules: { where: { active: true, targetType: "pet", targetId: pet.id }, orderBy: { createdAt: "desc" } } } : {}) },
      orderBy: { name: "asc" },
    });
    return res.json(services.filter(service => moduleAllowsAppointment(req.access, { service })).map(service => {
      const resolution = resolvePrice({
        petAgreedPrice: service.priceRules?.[0]?.price ?? null,
        petDefaultPrice: !additional && serviceModule({ service }) === "grooming" ? pet?.defaultGroomingPrice ?? null : null,
        serviceBasePrice: service.basePrice,
      });
      return { id: service.id, name: service.name, category: service.category?.name, price: resolution.finalPrice, priceSource: resolution.source, appliesCommissionSplit: service.appliesCommissionSplit ?? service.category?.appliesCommissionSplit ?? false };
    }));
  } catch (error) {
    console.error("[Cash] Catalog failed:", error.message);
    return res.status(503).json({ error: "No se pudo cargar el catálogo de servicios." });
  }
});
router.get('/cash/appointments/:id/checkout', async (req, res) => {
  try {
    const tenantId = req.tenant.tenantId;
    if (!tenantId || !req.access?.capabilities.cash) return res.status(403).json({ error: 'Caja no está habilitada.' });
    const row = await prisma.appointment.findFirst({ where: { tenantId, id: req.params.id }, include: APPOINTMENT_INCLUDE });
    if (!row || !moduleAllowsAppointment(req.access, row)) return res.status(404).json({ error: 'Cita no encontrada.' });
    const appointment = mapAppointmentRow(row);
    if (row.status !== 'completed' || appointment.payment?.status !== 'pending') return res.status(409).json({ error: 'Esta cita no tiene un pago pendiente. Consulta su comprobante en Caja.' });
    const servicePrice = appointment.priceResolution.finalPrice;
    const transportPrice = appointment.transport.price;
    const requiresServiceLine = isGroomingAppointment(row);
    const serviceLine = { id: 'appointment-service', description: row.service?.name || row.serviceType || 'Servicio de la atención', quantity: '1', unitPrice: servicePrice == null ? '' : String(servicePrice), itemKind: 'service', appointmentComponent: 'service' };
    return res.json({ appointmentId: row.id, transactionId: appointment.payment.transactionId,
      client: { id: row.userId, name: row.user?.name ?? null, phone: row.user?.phone ?? '', pets: row.petId ? [{ id: row.petId, name: appointment.petName, type: appointment.petType }] : [] },
      petId: row.petId ?? '', canAddTransport: requiresServiceLine, requiresServiceLine, serviceLine,
      lines: [
        ...(requiresServiceLine || servicePrice > 0 ? [serviceLine] : []),
        ...(requiresServiceLine && transportPrice != null && Number(transportPrice) > 0 ? [{ id: 'appointment-transport', description: 'Domicilio de peluquería', quantity: '1', unitPrice: String(transportPrice), itemKind: 'service', appointmentComponent: 'transport' }] : []),
      ] });
  } catch (error) { console.error('[Cash] Checkout read failed:', error.message); return res.status(503).json({ error: 'No se pudo preparar el cobro de la cita.' }); }
});
router.get("/workspace", async (req, res) => {
  try {
    const date = getBogotaYmd(), start = bogotaDayStart(date), end = new Date(start.getTime() + 86400000);
    const rows = req.access.capabilities.agenda ? await prisma.appointment.findMany({
      where: { tenantId: req.tenant.tenantId, date: { gte: start, lt: end } },
      include: APPOINTMENT_INCLUDE, orderBy: { date: "asc" }, take: 200,
    }) : [];
    const appointments = rows.filter(row => moduleAllowsAppointment(req.access, row) &&
      (!["vet", "groomer"].includes(req.access.role) || serviceModule(row) === (req.access.role === "vet" ? "veterinary" : "grooming")))
      .map(row => { const mapped = mapAppointmentRow(row); return req.access.capabilities.cash || req.access.capabilities.appointmentPrice ? mapped : { ...mapped, finalPrice: null, priceResolution: null, transport: { ...mapped.transport, price: null } }; });
    return res.json({ date, appointments, counts: {
      waiting: appointments.filter(a => a.status === "arrived").length,
      inProgress: appointments.filter(a => a.status === "in_progress").length,
      completed: appointments.filter(a => a.status === "completed").length,
      scheduled: appointments.filter(a => ["pending", "confirmed"].includes(a.status)).length,
    } });
  } catch (error) {
    console.error("[Workspace] Read failed:", error.message);
    return res.status(503).json({ error: "No se pudo cargar tu jornada" });
  }
});
router.get("/cash/operational", async (req, res) => {
  try {
    // A system charge already counts as income under ADR 007. A missing actor
    // means payment details need review, not that historical income is unpaid.
    return res.json(await readOperationalCash(prisma, req.tenant.tenantId, req.query, req.access));
  } catch (error) {
    if (error instanceof HistoryQueryError) return res.status(error.status).json({ error: error.message });
    console.error("[Cash] Operational read failed:", error.message);
    return res.status(503).json({ error: "No se pudo cargar la caja de hoy" });
  }
});
module.exports = router;
