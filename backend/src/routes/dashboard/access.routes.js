const router = require("express").Router();
const prisma = require("../../lib/prisma");
const { createHash } = require("node:crypto");
const { resolvePrice } = require("../../services/domain/price-resolver.service");
const { APPOINTMENT_INCLUDE, mapAppointmentRow, getBogotaYmd, bogotaDayStart } = require("./shared");
const { serviceModule, moduleAllowsAppointment } = require("../../services/dashboard-access.service");
const { readOperationalCash } = require("./operational-cash-page");
const { HistoryQueryError } = require("./financial-history-page");
router.get("/access", (req, res) => res.json(req.access));
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
    if (petId !== undefined && (typeof petId !== "string" || !petId)) return res.status(400).json({ error: "Mascota no válida." });
    const pet = petId ? await prisma.pet.findFirst({ where: { id: petId, tenantId }, select: { id: true, defaultGroomingPrice: true } }) : null;
    if (petId && !pet) return res.status(404).json({ error: "Mascota no encontrada en este establecimiento." });
    const services = await prisma.service.findMany({
      where: { tenantId, active: true },
      include: { category: { select: { name: true } }, ...(pet ? { priceRules: { where: { active: true, targetType: "pet", targetId: pet.id }, orderBy: { createdAt: "desc" } } } : {}) },
      orderBy: { name: "asc" },
    });
    return res.json(services.filter(service => moduleAllowsAppointment(req.access, { service })).map(service => {
      const resolution = resolvePrice({
        petAgreedPrice: service.priceRules?.[0]?.price ?? null,
        petDefaultPrice: serviceModule({ service }) === "grooming" ? pet?.defaultGroomingPrice ?? null : null,
        serviceBasePrice: service.basePrice,
      });
      return { id: service.id, name: service.name, category: service.category?.name, price: resolution.finalPrice, priceSource: resolution.source };
    }));
  } catch (error) {
    console.error("[Cash] Catalog failed:", error.message);
    return res.status(503).json({ error: "No se pudo cargar el catálogo de servicios." });
  }
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
      .map(row => { const mapped = mapAppointmentRow(row); return req.access.capabilities.cash || req.access.capabilities.appointmentPrice ? mapped : { ...mapped, finalPrice: null, priceResolution: null }; });
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
