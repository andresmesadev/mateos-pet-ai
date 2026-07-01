const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { getBogotaYmd, bogotaDayStart } = require("./shared");
const { getDailyClose } = require("../../contexts/finance");
const { DailyCloseNotFoundError } = require("../../contexts/finance/domain/errors");

// GET /daily-close?date=YYYY-MM-DD
// Adaptación progresiva (Entregable 2.3, finanzas-esquema-fisico.md): si ya existe
// un Cierre del Día oficial para la fecha, se traduce ese hecho congelado al
// contrato de respuesta ya existente. Si no existe, se calcula como antes de
// Fase 1 — leyendo Commission en vivo, sin recalcular reglas de negocio.
// El contrato de respuesta hacia el frontend no cambia en ningún caso.
router.get("/daily-close", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    const date =
      typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : getBogotaYmd();

    const dayStart = bogotaDayStart(date);
    const dayEnd   = new Date(dayStart.getTime() + 86_400_000);

    // ── 1. Appointment summary for the day (sin cambios, Fase 1) ─────────────
    const appointments = await prisma.appointment.findMany({
      where: { ...tenantFilter, date: { gte: dayStart, lt: dayEnd } },
      select: {
        id: true, status: true, staffId: true, petId: true,
        petName: true, serviceType: true,
        service: { select: { category: { select: { name: true } } } },
        commission: {
          select: {
            id: true, resolvedPrice: true, priceSource: true,
            staffShare: true, businessShare: true, splitRate: true,
            staffId: true, staff: { select: { name: true } },
          },
        },
      },
    });

    const total      = appointments.length;
    const completed  = appointments.filter((a) => a.status === "completed").length;
    const cancelled  = appointments.filter((a) => a.status === "cancelled").length;
    const noShow     = appointments.filter((a) => a.status === "no_show").length;
    const pending    = appointments.filter(
      (a) => !["completed", "cancelled", "no_show"].includes(a.status)
    ).length;

    // ── 2. Commission summary — hecho oficial si existe, lectura en vivo si no ─
    let commissionsSection;
    let missingCommissionsCount;

    try {
      const { dailyClose } = await getDailyClose({ tenantId: tenantId ?? null, date });

      const staffIds = dailyClose.staffBreakdown.map((b) => b.staffId).filter(Boolean);
      const staffRows = staffIds.length
        ? await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
        : [];
      const nameById = new Map(staffRows.map((s) => [s.id, s.name]));

      const byStaff = dailyClose.staffBreakdown.map((entry) => ({
        staffId: entry.staffId ?? null,
        staffName: entry.staffId ? (nameById.get(entry.staffId) ?? "Sin asignar") : "Sin asignar",
        count: entry.count,
        revenue: Number(entry.staffShare) + Number(entry.businessShare),
        staffShare: Number(entry.staffShare),
        businessShare: Number(entry.businessShare),
      }));

      commissionsSection = {
        count: byStaff.reduce((s, b) => s + b.count, 0),
        totalRevenue: Number(dailyClose.incomeTotal),
        totalStaffShare: byStaff.reduce((s, b) => s + b.staffShare, 0),
        totalBusinessShare: byStaff.reduce((s, b) => s + b.businessShare, 0),
        byStaff,
      };

      // El cierre ya es un hecho oficial e inmutable: por definición no puede
      // haber comisiones faltantes que aún no se hayan consolidado.
      missingCommissionsCount = 0;
    } catch (err) {
      if (!(err instanceof DailyCloseNotFoundError)) throw err;

      // Sin Cierre del Día oficial todavía: mismo cálculo en vivo de siempre,
      // leyendo Commission — nunca recalculando sus reglas de negocio.
      const commissions = await prisma.commission.findMany({
        where: { ...tenantFilter, completedAt: { gte: dayStart, lt: dayEnd } },
        include: { staff: { select: { id: true, name: true } } },
      });

      const totalRevenue       = commissions.reduce((s, c) => s + Number(c.resolvedPrice), 0);
      const totalStaffShare    = commissions.reduce((s, c) => s + Number(c.staffShare), 0);
      const totalBusinessShare = commissions.reduce((s, c) => s + Number(c.businessShare), 0);

      const staffMap = new Map();
      for (const c of commissions) {
        const key = c.staffId ?? "__unassigned__";
        const name = c.staff?.name ?? "Sin asignar";
        if (!staffMap.has(key)) {
          staffMap.set(key, { staffId: c.staffId ?? null, staffName: name, count: 0, revenue: 0, staffShare: 0, businessShare: 0 });
        }
        const entry = staffMap.get(key);
        entry.count += 1;
        entry.revenue += Number(c.resolvedPrice);
        entry.staffShare += Number(c.staffShare);
        entry.businessShare += Number(c.businessShare);
      }

      commissionsSection = {
        count: commissions.length,
        totalRevenue,
        totalStaffShare,
        totalBusinessShare,
        byStaff: [...staffMap.values()],
      };

      const completedGroomingIds = new Set(
        appointments
          .filter((a) => {
            const isCompleted = a.status === "completed";
            const cat = a.service?.category?.name ?? "";
            const stype = (a.serviceType ?? "").toLowerCase();
            const isGrooming = cat === "grooming" ||
              ["grooming","bath","baño","peluquer","corte","spa","deslanado","colorimetría","colorimetria","antipulgas"]
                .some((p) => stype.includes(p));
            return isCompleted && isGrooming;
          })
          .map((a) => a.id)
      );
      const commissionsApptIds = new Set(commissions.map((c) => c.appointmentId));
      missingCommissionsCount = [...completedGroomingIds].filter((id) => !commissionsApptIds.has(id)).length;
    }

    res.json({
      date,
      appointments: { total, completed, cancelled, noShow, pending },
      commissions: commissionsSection,
      missingCommissionsCount,
    });
  } catch (error) {
    console.error("[DailyClose] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
