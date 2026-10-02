const router = require("express").Router();
const prisma = require("../../lib/prisma");
const { APPOINTMENT_INCLUDE, mapAppointmentRow, mapTransaction, getBogotaYmd, bogotaDayStart } = require("./shared");
const { serviceModule, moduleAllowsAppointment } = require("../../services/dashboard-access.service");
router.get("/access", (req, res) => res.json(req.access));
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
    const date = getBogotaYmd(), start = bogotaDayStart(date), end = new Date(start.getTime() + 86400000);
    const rows = await prisma.transaction.findMany({
      where: { tenantId: req.tenant.tenantId, status: "active", paidAt: { gte: start, lt: end } },
      include: { user: { select: { name: true, phone: true } }, pet: { select: { name: true, type: true } }, items: true },
      orderBy: { paidAt: "desc" }, take: 200,
    });
    // A system charge already counts as income under ADR 007. A missing actor
    // means payment details need review, not that historical income is unpaid.
    return res.json({ date, transactions: rows.map(mapTransaction),
      toReview: rows.filter(row => row.origin === "system_appointment_completed" && !row.recordedActorId).map(row => row.id),
      totalRegistered: rows.reduce((total, row) => total + Number(row.total), 0),
      hasMore: rows.length === 200,
    });
  } catch (error) {
    console.error("[Cash] Operational read failed:", error.message);
    return res.status(503).json({ error: "No se pudo cargar la caja de hoy" });
  }
});
module.exports = router;
